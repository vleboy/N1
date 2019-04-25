const RoleCodeEnum = require('../lib/Model').RoleCodeEnum
const GameTypeEnum = require('../lib/Model').GameTypeEnum
const Tables = require('../lib/Model').Tables
const Model = require('../lib/Model').Model
const BaseModel = require('./BaseModel')
const ConfigModel = require('./ConfigModel')
const LogModel = require('./LogModel')
const SysTransferModel = require('./SysTransferModel')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const moment = require('moment')
const _ = require('lodash')
const config = require('config')

class UserModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.ZeusPlatformUser,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            role: Model.StringValue,
            userId: Model.StringValue
        }
    }

    /**
      * 通过userId查询用户
      * @param {*} userId 
      * @param {*} options 
      */
    async queryUserById(userId, options) {
        let query = {
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        }
        if (options) {
            query.ProjectionExpression = options.ProjectionExpression
            query.ExpressionAttributeNames = options.ExpressionAttributeNames
        }
        const [queryErr, querySet] = await this.query(query)
        return [queryErr, querySet.Items[0]]
    }

    /**
     * 根据用户id 获取所有上级用户
     */
    async getAllParent(inparam) {
        let parentInfo = []
        let flag = true
        while (flag) {
            let [queryOneErr, queryRet] = await this.query({
                IndexName: 'UserIdIndex',
                ProjectionExpression: 'userId,#role,parent,betAmountMap,mixAmountMap,winloseAmountMap,companyList',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeNames: {
                    '#role': 'role'
                },
                ExpressionAttributeValues: {
                    ':userId': inparam.parent
                }
            })
            if (queryRet.Items.length != 0) {
                let retInfo = queryRet.Items[0]
                parentInfo.push({ userId: retInfo.userId, role: retInfo.role, betAmountMap: retInfo.betAmountMap, mixAmountMap: retInfo.mixAmountMap, winloseAmountMap: retInfo.winloseAmountMap, companyList: retInfo.companyList })
                if (retInfo.parent != '01') { //说明不是直属的
                    inparam.parent = retInfo.parent
                } else {
                    flag = false
                }
            } else {
                flag = false
            }
        }
        return parentInfo
    }

    /**
     * 计算汇总平台所有用户的金额数据（默认起始时间为2018-02-05 00:00:00）
     */
    async calcAllAmount() {
        // 从配置文件中获取最后一条记录时间
        const [configErr, configRet] = await new ConfigModel().queryLastTime({ code: 'roundLast' })
        let startTime = configRet.lastAllAmountTime ? configRet.lastAllAmountTime + 1 : 1517760000000 // 上次全平台用户的统计时间
        let isInit = startTime == 1517760000000 ? true : false // 是否全部重置所有数据
        let createdAt = [startTime, configRet.lastTime]
        let self = this
        let promiseArr = [] // 所有单层级用户查询Promise数组
        let managers = []   // 所有线路商
        let merchants = []  // 所有商户
        let agents = []     // 所有代理
        let axiosArr = []   // 需要停用的请求数组
        // 查询平台所有用户
        console.log(`【点数告警列表】，统计时间范围【${createdAt[0]} - ${createdAt[1]}】`)
        const [queryErr, queryRet] = await self.scan({
            ProjectionExpression: '#role,levelIndex,userId,betAmountMap,winloseAmountMap,mixAmountMap,selfBetAmountMap,selfWinloseAmountMap,selfMixAmountMap,companyList,gameList,username',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            FilterExpression: "levelIndex <> :levelIndex",
            ExpressionAttributeValues: {
                ':levelIndex': '0'
            }
        })
        // 遍历平台所有用户
        for (let user of queryRet.Items) {
            // 如果是从零开始初始，则将所有用户的Map置空
            if (isInit) {
                console.log(`【点数告警列表】用户【${user.userId}】所有金额Map初始置空`)
                user.betAmountMap = {}
                user.winloseAmountMap = {}
                user.mixAmountMap = {}
                user.selfBetAmountMap = {}
                user.selfWinloseAmountMap = {}
                user.selfMixAmountMap = {}
            }
            if (user.role == RoleCodeEnum.Manager) {
                managers.push(user)
                continue
            }
            if (user.role == RoleCodeEnum.Agent) {
                agents.push(user)
            }
            // 更新商户和代理
            let p = new Promise(async (resolve, reject) => {
                // 查询统计用户的所有金额数据
                let mapResult = await self.calcParentStat({ user, createdAt, isInit })
                // 集合所有商户
                if (user.role != RoleCodeEnum.Agent && (mapResult.isChange || isInit)) {
                    user.betAmountMap = mapResult.betAmountMap
                    user.winloseAmountMap = mapResult.winloseAmountMap
                    user.mixAmountMap = mapResult.mixAmountMap
                    //获取新的companyList
                    let newcompanyList = getNewcompanyList(user)
                    await self.updateItem({
                        Key: { 'role': user.role, 'userId': user.userId },
                        UpdateExpression: 'SET betAmountMap=:betAmountMap,winloseAmountMap=:winloseAmountMap,mixAmountMap=:mixAmountMap,companyList=:companyList',
                        ExpressionAttributeValues: {
                            ':betAmountMap': user.betAmountMap,
                            ':winloseAmountMap': user.winloseAmountMap,
                            ':mixAmountMap': user.mixAmountMap,
                            ':companyList': newcompanyList
                        }
                    })
                    merchants.push(user)
                    //校验点数是否超过预设点数
                    axiosArr.push(checkMapTop(mapResult.winloseAmountMap, user, createdAt[1]))
                }
                // 集合所有代理
                if (user.role == RoleCodeEnum.Agent) {
                    user.selfBetAmountMap = mapResult.selfBetAmountMap
                    user.selfWinloseAmountMap = mapResult.selfWinloseAmountMap
                    user.selfMixAmountMap = mapResult.selfMixAmountMap
                }
                resolve('Y')
            })
            promiseArr.push(p)
        }
        // 并发等待所有用户数据更新完成
        if (promiseArr.length > 0) {
            await Promise.all(promiseArr)
        }
        // console.log('【点数告警列表】代理...')
        // 开始更新父级代理
        for (let m of agents) {
            m.betAmountMap = _.cloneDeep(m.selfBetAmountMap)
            m.winloseAmountMap = _.cloneDeep(m.selfWinloseAmountMap)
            m.mixAmountMap = _.cloneDeep(m.selfMixAmountMap)
            // 遍历原始用户数组，累加子孙的玩家数据，和自己的玩家数据
            for (let u of agents) {
                if (u.levelIndex.indexOf(m.userId) > 0) {
                    for (let gameType in u.selfBetAmountMap) {
                        let initGameType = GameTypeEnum[gameType.toString()]
                        if (!m.betAmountMap[gameType]) {
                            m.betAmountMap[gameType] = { ...initGameType, betAmount: 0 }
                        }
                        m.betAmountMap[gameType].betAmount += u.selfBetAmountMap[gameType].betAmount
                    }
                    for (let gameType in u.selfWinloseAmountMap) {
                        let initGameType = GameTypeEnum[gameType.toString()]
                        if (!m.winloseAmountMap[gameType]) {
                            m.winloseAmountMap[gameType] = { ...initGameType, winloseAmount: 0 }
                        }
                        m.winloseAmountMap[gameType].winloseAmount += u.selfWinloseAmountMap[gameType].winloseAmount
                    }
                    for (let gameType in u.selfMixAmountMap) {
                        let initGameType = GameTypeEnum[gameType.toString()]
                        if (!m.mixAmountMap[gameType]) {
                            m.mixAmountMap[gameType] = { ...initGameType, mixAmount: 0 }
                        }
                        m.mixAmountMap[gameType].mixAmount += u.selfMixAmountMap[gameType].mixAmount
                    }
                }
            }
            //获取新的companyList
            let newcompanyList = getNewcompanyList(m)
            await self.updateItem({
                Key: { 'role': m.role, 'userId': m.userId },
                UpdateExpression: 'SET betAmountMap=:betAmountMap,winloseAmountMap=:winloseAmountMap,mixAmountMap=:mixAmountMap,selfBetAmountMap=:selfBetAmountMap,selfWinloseAmountMap=:selfWinloseAmountMap,selfMixAmountMap=:selfMixAmountMap,companyList=:companyList',
                ExpressionAttributeValues: {
                    ':betAmountMap': m.betAmountMap,
                    ':winloseAmountMap': m.winloseAmountMap,
                    ':mixAmountMap': m.mixAmountMap,
                    ':selfBetAmountMap': m.selfBetAmountMap,
                    ':selfWinloseAmountMap': m.selfWinloseAmountMap,
                    ':selfMixAmountMap': m.selfMixAmountMap,
                    ':companyList': newcompanyList
                }
            })
            //校验点数是否超过预设点数
            axiosArr.push(checkMapTop(m.winloseAmountMap, m, createdAt[1]))
        }
        // console.log('【点数告警列表】线路商...')
        // 开始更新线路商
        for (let m of managers) {
            let isChangeManager = false
            m.betAmountMap = {}
            m.winloseAmountMap = {}
            m.mixAmountMap = {}
            for (let u of merchants) {
                // 匹配商户是否是线路商的下级
                if (u.levelIndex.indexOf(m.userId) > 0) {
                    for (let gameType in u.betAmountMap) {
                        let initGameType = GameTypeEnum[gameType.toString()]
                        if (!m.betAmountMap[gameType]) {
                            m.betAmountMap[gameType] = { ...initGameType, betAmount: 0 }
                        }
                        m.betAmountMap[gameType].betAmount += u.betAmountMap[gameType].betAmount
                    }
                    for (let gameType in u.winloseAmountMap) {
                        let initGameType = GameTypeEnum[gameType.toString()]
                        if (!m.winloseAmountMap[gameType]) {
                            m.winloseAmountMap[gameType] = { ...initGameType, winloseAmount: 0 }
                        }
                        m.winloseAmountMap[gameType].winloseAmount += u.winloseAmountMap[gameType].winloseAmount
                    }
                    for (let gameType in u.mixAmountMap) {
                        let initGameType = GameTypeEnum[gameType.toString()]
                        if (!m.mixAmountMap[gameType]) {
                            m.mixAmountMap[gameType] = { ...initGameType, mixAmount: 0 }
                        }
                        m.mixAmountMap[gameType].mixAmount += u.mixAmountMap[gameType].mixAmount
                    }
                    isChangeManager = true
                }
            }
            if (isChangeManager) {
                //获取新的companyList
                let newcompanyList = getNewcompanyList(m)
                await self.updateItem({
                    Key: { 'role': m.role, 'userId': m.userId },
                    UpdateExpression: 'SET betAmountMap=:betAmountMap,winloseAmountMap=:winloseAmountMap,mixAmountMap=:mixAmountMap,companyList=:companyList',
                    ExpressionAttributeValues: {
                        ':betAmountMap': m.betAmountMap,
                        ':winloseAmountMap': m.winloseAmountMap,
                        ':mixAmountMap': m.mixAmountMap,
                        ':companyList': newcompanyList
                    }
                })
                //校验点数是否超过预设点数
                axiosArr.push(checkMapTop(m.winloseAmountMap, m, createdAt[1]))
            }
        }
        //请求接口停用改运营商的游戏
        axiosArr = _.flatten(axiosArr)
        if (axiosArr.length > 0) {
            console.log(`【点数告警列表】一共需要请求变更用户状态数量为：【${axiosArr.length}】`)
            let tokenAdmin = await jwt.sign({
                role: RoleCodeEnum.PlatformAdmin,
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) * 3,
                iat: Math.floor(Date.now() / 1000) - 30
            }, config.na.TOKEN_SECRET)
            let tokenAgent = await jwt.sign({
                role: RoleCodeEnum.Agent,
                suffix: 'Agent',
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) * 3,
                iat: Math.floor(Date.now() / 1000) - 30
            }, config.na.TOKEN_SECRET)
            // 判断推送正式服还是测试服
            let agentChangeStatusUrl = 'https://d3prd6rbitzqm3.cloudfront.net/userChangeStatus'
            let adminChangeStatusUrl = 'https://d3rqtlfdd4m9wd.cloudfront.net/userChangeStatus'
            if (config.na.apidomain == 'webgame.na77.org') {
                agentChangeStatusUrl = 'https://n1agent.na12345.com/userChangeStatus'
                adminChangeStatusUrl = 'https://n1admin.na12345.com/userChangeStatus'
            }
            for (let i of axiosArr) {
                console.log('【点数告警列表】请求userChangeStatus参数：' + JSON.stringify(i))
                if (i.role == RoleCodeEnum.Agent) {
                    axios.post(agentChangeStatusUrl, i, {
                        headers: { 'Authorization': `Bearer ${tokenAgent}` }
                    }).catch(err => {
                        console.error(err)
                    })
                } else {
                    axios.post(adminChangeStatusUrl, i, {
                        headers: { 'Authorization': `Bearer ${tokenAdmin}` }
                    }).catch(err => {
                        console.error(err)
                    })
                }
            }
        }
        new ConfigModel().updateItem({
            Key: { code: "roundLast" },
            UpdateExpression: 'SET lastAllAmountTime = :lastAllAmountTime',
            ExpressionAttributeValues: {
                ':lastAllAmountTime': createdAt[1]
            }
        })
        // console.log('【点数告警列表】统计结束')
    }

    /**
     * 统计接入方消耗金额数据（默认起始时间为2018-10-01 00:00:00）
     */
    async calcTransferAmount() {
        //1.查询配置表取出lastTransferTime时间
        const [configErr, configRet] = await new ConfigModel().queryLastTime({ code: 'roundLast' })
        let startTime = configRet.lastTransferTime ? configRet.lastTransferTime + 1 : 1538323200000 // 上次统计时间
        let endTime = Date.now()
        console.log(`【接入方点数累计】统计时间范围【${startTime} - ${endTime}】`)
        //2.查询需要统计的用户
        let [userErr, userRes] = await this.query({
            KeyConditionExpression: '#role = :role',
            ProjectionExpression: 'userId,sn,transferURL,transferMap',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':role': RoleCodeEnum.Merchant
            }
        })
        let promiseArr = []
        let sysTransferModel = new SysTransferModel()
        for (let user of userRes.Items) {
            if (user.transferURL) {
                let p = new Promise(async (resolve, reject) => {
                    if (startTime == 1538323200000 || !user.transferMap) { //初始化
                        user.transferMap = {}
                    }
                    //查询 时间段的共享钱包流水map汇总
                    let platMap = await sysTransferModel.queryDetail(user, startTime, endTime)
                    //更新map
                    await this.updateItem({
                        Key: { role: RoleCodeEnum.Merchant, userId: user.userId },
                        UpdateExpression: 'SET transferMap=:transferMap',
                        ExpressionAttributeValues: {
                            ':transferMap': platMap.transferMap
                        }
                    })
                    resolve(1)
                })
                promiseArr.push(p)
            }
        }
        await Promise.all(promiseArr)
        //更新配置文件
        await new ConfigModel().updateItem({
            Key: { code: "roundLast" },
            UpdateExpression: 'SET lastTransferTime = :lastTransferTime',
            ExpressionAttributeValues: {
                ':lastTransferTime': endTime
            }
        })
    }

    /**
 * 通过父级查询玩家统计
 * @param {*} inparam 
 */
    async calcParentStat(inparam) {
        try {
            let self = this
            let isChange = false
            let parent = inparam.user.userId
            let createdAt = inparam.createdAt
            if (!inparam.user.betAmountMap) {
                inparam.user.betAmountMap = {}
                isChange = true
            }
            if (!inparam.user.winloseAmountMap) {
                inparam.user.winloseAmountMap = {}
                isChange = true
            }
            if (!inparam.user.mixAmountMap) {
                inparam.user.mixAmountMap = {}
                isChange = true
            }
            if (!inparam.user.selfBetAmountMap) {
                inparam.user.selfBetAmountMap = {}
                isChange = true
            }
            if (!inparam.user.selfWinloseAmountMap) {
                inparam.user.selfWinloseAmountMap = {}
                isChange = true
            }
            if (!inparam.user.selfMixAmountMap) {
                inparam.user.selfMixAmountMap = {}
                isChange = true
            }
            // 获取首天和尾天的查询时间范围
            let startDateStr = moment(+createdAt[0]).utcOffset(8).format('YYYY-MM-DD')
            let endDateStr = moment(+createdAt[1]).utcOffset(8).format('YYYY-MM-DD')
            let startTimeStr = moment(+createdAt[0]).utcOffset(8).format('HH:mm:ss')
            let endTimeStr = moment(+createdAt[1]).utcOffset(8).format('HH:mm:ss')
            let firstTimeEndStr = 'T23:59:59+08:00'
            let lastTimeStartStr = 'T00:00:00+08:00'
            let firstTimeEnd = new Date(`${startDateStr}${firstTimeEndStr}`)
            let lastTimeStart = new Date(`${endDateStr}${lastTimeStartStr}`)
            let firstTime = startDateStr == endDateStr ? createdAt : [createdAt[0], firstTimeEnd.getTime() + 999] // 同一天查询，直接使用入参
            const lastTime = [lastTimeStart.getTime(), createdAt[1]]
            // 定义查询变量
            let p1 = null
            let p2 = null
            let p3 = null
            let promiseArr = []
            let roundDayArr = []
            let roundArr = []
            let isQueryFirstDay = true
            let isQueryLastDay = true
            // 只有天数间隔大于等于0时，才查询局天表，获取局天表间隔范围
            let startDay = parseInt(moment(+createdAt[0] + 24 * 60 * 60 * 1000).utcOffset(8).format('YYYYMMDD'))
            let endDay = parseInt(moment(+createdAt[1] - 24 * 60 * 60 * 1000).utcOffset(8).format('YYYYMMDD'))
            if (endDay - startDay >= 0) {
                if (startTimeStr == '00:00:00') {
                    startDay--
                    isQueryFirstDay = false
                }
                if (endTimeStr == '00:00:00') {
                    isQueryLastDay = false
                }
                let query = {
                    TableName: Tables.StatRoundDay,
                    IndexName: 'ParentIndex',
                    ProjectionExpression: 'parent,userId,userName,betCount,betAmount,retAmount,winAmount,refundAmount,winloseAmount,mixAmount,gameType,gameTypeData',
                    KeyConditionExpression: 'parent = :parent AND createdDate between :createdAt0 AND :createdAt1',
                    FilterExpression: 'gameType <> :longTimeGameType1',
                    ExpressionAttributeValues: {
                        ':parent': parent,
                        ':createdAt0': startDay,
                        ':createdAt1': endDay,
                        ':longTimeGameType1': 1100000   // UG体育游戏排除
                    }
                }
                // 正常每3分钟定时统计是不需要统计YSB体育游戏，只有在异常重建时需要添加
                if (!inparam.isInit) {
                    query.FilterExpression += ' AND gameType <> :longTimeGameType2'
                    query.ExpressionAttributeValues[':longTimeGameType2'] = 1130000
                }
                p3 = self.queryOnce(query)
            }
            // 查询首天
            if (isQueryFirstDay) {
                p1 = self.calcParentInterval({ parent, createdAt: firstTime, isInit: inparam.isInit })
            }
            // 查询尾天
            if (isQueryLastDay) {
                if (startDateStr != endDateStr) {
                    p2 = self.calcParentInterval({ parent, createdAt: lastTime, isInit: inparam.isInit })
                }
            }
            // 组装promiseArr并发查询
            if (p1) {
                promiseArr.push(p1)
            }
            if (p2) {
                promiseArr.push(p2)
            }
            if (p3) {
                promiseArr.push(p3)
            }
            let res = await Promise.all(promiseArr)
            // 合并结果
            if (p3) {
                for (let i = 0; i < res.length - 1; i++) {
                    roundArr = roundArr.concat(res[i].Items)
                }
                if (res[res.length - 1].Items) {
                    roundDayArr = res[res.length - 1].Items
                }
            } else {
                for (let i of res) {
                    roundArr = roundArr.concat(i.Items)
                }
            }
            // 合并局天表中所有数据
            for (let item of roundDayArr) {
                for (let gameTypeItem of item.gameTypeData) {
                    // 对应游戏大类金额初始
                    let initGameType = GameTypeEnum[gameTypeItem.gameType.toString()]
                    if (inparam.user.role == RoleCodeEnum.Agent) {
                        // 用户没有该游戏大类统计，初始化
                        if (!inparam.user.selfBetAmountMap[gameTypeItem.gameType]) {
                            inparam.user.selfBetAmountMap[gameTypeItem.gameType] = { ...initGameType, betAmount: 0.0 }
                        }
                        if (!inparam.user.selfWinloseAmountMap[gameTypeItem.gameType]) {
                            inparam.user.selfWinloseAmountMap[gameTypeItem.gameType] = { ...initGameType, winloseAmount: 0.0 }
                        }
                        if (!inparam.user.selfMixAmountMap[gameTypeItem.gameType]) {
                            inparam.user.selfMixAmountMap[gameTypeItem.gameType] = { ...initGameType, mixAmount: 0.0 }
                        }
                        // 用户对应游戏大类金额累加
                        inparam.user.selfBetAmountMap[gameTypeItem.gameType].betAmount -= gameTypeItem.betAmount
                        inparam.user.selfWinloseAmountMap[gameTypeItem.gameType].winloseAmount -= gameTypeItem.winloseAmount
                        inparam.user.selfMixAmountMap[gameTypeItem.gameType].mixAmount += gameTypeItem.mixAmount
                    } else {
                        // 用户没有该游戏大类统计，初始化
                        if (!inparam.user.betAmountMap[gameTypeItem.gameType]) {
                            inparam.user.betAmountMap[gameTypeItem.gameType] = { ...initGameType, betAmount: 0.0 }
                        }
                        if (!inparam.user.winloseAmountMap[gameTypeItem.gameType]) {
                            inparam.user.winloseAmountMap[gameTypeItem.gameType] = { ...initGameType, winloseAmount: 0.0 }
                        }
                        if (!inparam.user.mixAmountMap[gameTypeItem.gameType]) {
                            inparam.user.mixAmountMap[gameTypeItem.gameType] = { ...initGameType, mixAmount: 0.0 }
                        }
                        // 用户对应游戏大类金额累加
                        inparam.user.betAmountMap[gameTypeItem.gameType].betAmount -= gameTypeItem.betAmount
                        inparam.user.winloseAmountMap[gameTypeItem.gameType].winloseAmount -= gameTypeItem.winloseAmount
                        inparam.user.mixAmountMap[gameTypeItem.gameType].mixAmount += gameTypeItem.mixAmount
                    }
                    isChange = true
                }
            }
            // 合并局表中所有数据
            for (let round of roundArr) {
                // 对应游戏大类金额初始
                let initGameType = GameTypeEnum[round.gameType.toString()]
                if (inparam.user.role == RoleCodeEnum.Agent) {
                    // 用户没有该游戏大类统计，初始化
                    if (!inparam.user.selfBetAmountMap[round.gameType]) {
                        inparam.user.selfBetAmountMap[round.gameType] = { ...initGameType, betAmount: 0.0 }
                    }
                    if (!inparam.user.selfWinloseAmountMap[round.gameType]) {
                        inparam.user.selfWinloseAmountMap[round.gameType] = { ...initGameType, winloseAmount: 0.0 }
                    }
                    if (!inparam.user.selfMixAmountMap[round.gameType]) {
                        inparam.user.selfMixAmountMap[round.gameType] = { ...initGameType, mixAmount: 0.0 }
                    }
                    // 用户对应游戏大类金额累加
                    inparam.user.selfBetAmountMap[round.gameType].betAmount -= round.betAmount
                    inparam.user.selfWinloseAmountMap[round.gameType].winloseAmount -= round.winloseAmount
                    inparam.user.selfMixAmountMap[round.gameType].mixAmount += round.mixAmount
                } else {
                    // 用户没有该游戏大类统计，初始化
                    if (!inparam.user.betAmountMap[round.gameType]) {
                        inparam.user.betAmountMap[round.gameType] = { ...initGameType, betAmount: 0.0 }
                    }
                    if (!inparam.user.winloseAmountMap[round.gameType]) {
                        inparam.user.winloseAmountMap[round.gameType] = { ...initGameType, winloseAmount: 0.0 }
                    }
                    if (!inparam.user.mixAmountMap[round.gameType]) {
                        inparam.user.mixAmountMap[round.gameType] = { ...initGameType, mixAmount: 0.0 }
                    }
                    // 用户对应游戏大类金额累加
                    inparam.user.betAmountMap[round.gameType].betAmount -= round.betAmount
                    inparam.user.winloseAmountMap[round.gameType].winloseAmount -= round.winloseAmount
                    inparam.user.mixAmountMap[round.gameType].mixAmount += round.mixAmount
                }
                isChange = true
            }
            return { betAmountMap: inparam.user.betAmountMap, winloseAmountMap: inparam.user.winloseAmountMap, mixAmountMap: inparam.user.mixAmountMap, selfBetAmountMap: inparam.user.selfBetAmountMap, selfWinloseAmountMap: inparam.user.selfWinloseAmountMap, selfMixAmountMap: inparam.user.selfMixAmountMap, isChange: isChange }
        } catch (error) {
            console.log(error)
        }
    }

    /**
     * 查询父级对应所有玩家间隔时间段的内的局汇总
     * @param {*} inparam 
     */
    async calcParentInterval(inparam) {
        let self = this
        return new Promise(async function (resolve, reject) {
            let query = {
                TableName: Tables.StatRound,
                IndexName: 'ParentIndex',
                ProjectionExpression: 'parent,userId,userName,betCount,betAmount,retAmount,winAmount,refundAmount,winloseAmount,mixAmount,gameType',
                KeyConditionExpression: 'parent = :parent AND createdAt between :createdAt0 AND :createdAt1',
                FilterExpression: "gameType > :gameType AND gameType <> :longTimeGameType1",
                ExpressionAttributeValues: {
                    ':parent': inparam.parent,
                    ':createdAt0': parseInt(inparam.createdAt[0]),
                    ':createdAt1': parseInt(inparam.createdAt[1]),
                    ':gameType': 10000,
                    ':longTimeGameType1': 1100000   // UG体育游戏排除
                }
            }
            // 正常每3分钟定时统计是不需要统计YSB体育游戏，只有在异常重建时需要添加
            if (!inparam.isInit) {
                query.FilterExpression += ' AND gameType <> :longTimeGameType2'
                query.ExpressionAttributeValues[':longTimeGameType2'] = 1130000
            }
            self.query(query).then((resArr) => {
                resolve(resArr[1])
            }).catch((err) => {
                reject(err)
            })
        })
    }
}
// 内部方法，检查是否超过告警阀值
function checkMapTop(winloseAmountMap, user, createdAt) {
    let arr = []
    let flag = false
    let groupMap = _.groupBy(winloseAmountMap, 'company')                       // 运营商分组
    if (!_.isEmpty(user.companyList)) {
        for (let item of user.companyList) {                                    // 遍历每一个运营商
            for (let i in groupMap) {
                if (item.company == i && item.status == 1) {                    // 匹配运营商并且没有停用
                    let totalWinloseAmount = _.sumBy(groupMap[i], 'winloseAmount')
                    if (item.topAmount != 0 && totalWinloseAmount >= item.topAmount) {                       // 如果大于预设点数则添加到数组中
                        item.status = 0
                        flag = true
                        let inparam = {
                            userName: user.username,
                            userId: user.userId,
                            totalWinloseAmount,
                            createdAt,
                            topAmount: item.topAmount,
                            company: item.company
                        }
                        new LogModel().add('7', 'pointControl', inparam, '超过预警值')
                    }
                }
            }
        }
        if (flag) {
            arr.push({
                companyList: user.companyList,
                switch: 0,
                userId: user.userId,
                role: user.role
            })
        }

    }
    return arr
}
// 内部方法，获取新的companyList
function getNewcompanyList(user) {
    let newcompanyList = []
    let oldcompanyList = user.companyList || []
    let gameList = _.groupBy(user.gameList, 'company')
    let groupMap = _.groupBy(user.winloseAmountMap, 'company')
    for (let company in gameList) {                                 //根据游戏列表生成新的companyLsit 
        let flag = true
        for (let item of oldcompanyList) {
            if (item.company == company) {                          //原来已经存在
                flag = false
                newcompanyList.push(item)
            }
        }
        if (flag) {                                                 //不存在 默认赋值
            newcompanyList.push({ company, topAmount: 0, winloseAmount: 0, status: 1 })
        }
    }
    for (let i in groupMap) {                                       //根据winloseAmountMap赋值
        for (let listItem of newcompanyList) {
            if (i == listItem.company) {
                listItem.winloseAmount = +_.sumBy(groupMap[i], 'winloseAmount').toFixed(2)
            }
        }
    }
    return newcompanyList
}

module.exports = UserModel
