const moment = require('moment')
const _ = require('lodash')
const GlobalConfig = require("../util/config")
const BaseModel = require('./BaseModel')

class PlayerBillModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.StatRoundDay,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 查询玩家时间段内的日报表统计
     * @param {*} inparam 
     */
    async calcPlayerDayStat(inparam) {
        let query = {
            KeyConditionExpression: 'userName = :userName AND createdDate BETWEEN :createdDate0 AND :createdDate1',
            ExpressionAttributeValues: {
                ':userName': inparam.userName,
                ':createdDate0': inparam.startTime,
                ':createdDate1': inparam.endTime
            }
        }
        const res = await this.query(query)
        let finalRes = []
        if (inparam.gameType) {  //如果传了游戏类型则过滤
            for (let item of res.Items) {
                let index = _.findIndex(item.gameTypeData, function (o) { return o.gameType == inparam.gameType })
                if (index != -1) {
                    finalRes.push(item.gameTypeData[index])
                }
            }
        } else {
            finalRes = res.Items
        }
        return finalRes
    }

    /**
     * 查询代理用户时间段内的日报表统计
     * @param {*} inparam 
     */
    async calcParentDayStat(inparam) {
        let query = {
            IndexName: 'ParentIndex',
            KeyConditionExpression: 'parent = :parent AND createdDate BETWEEN :createdDate0 AND :createdDate1',
            ExpressionAttributeValues: {
                ':parent': inparam.parentId,
                ':createdDate0': inparam.startTime,
                ':createdDate1': inparam.endTime
            }
        }
        const res = await this.query(query)
        let finalRes = []
        if (inparam.gameType) {  //如果传了游戏类型则过滤
            for (let item of res.Items) {
                let index = _.findIndex(item.gameTypeData, function (o) { return o.gameType == inparam.gameType })
                if (index != -1) {
                    finalRes.push(item.gameTypeData[index])
                }
            }
        } else {
            finalRes = res.Items
        }
        return finalRes
    }

    /**
     * 查询玩家统计
     * @param {*} inparam 
     */
    async calcPlayerStat(inparam) {
        let promiseArr = []
        let self = this
        // 组装所有玩家局查询promise
        for (let gameUserName of inparam.gameUserNames) {
            let playerInparam = { userName: gameUserName, gameType: inparam.gameType, gameTypeObj: inparam.gameTypeObj, createdAt: inparam.query.createdAt }
            let playerPromise = null
            // 查询商城
            if (inparam.gameType == 3) {
                playerPromise = self.calcPlayerBill(playerInparam)
            }
            // 查询游戏
            else {
                playerPromise = self.calcPlayerRound(playerInparam)
            }
            promiseArr.push(playerPromise)
        }
        // 并发所有玩家局汇总查询
        let finalRes = []
        let start = Date.now()
        if (promiseArr.length > 0) {
            finalRes = await Promise.all(promiseArr)
        }
        let end = Date.now()
        console.log(`所有${promiseArr.length}个并发执行耗时【${end - start}毫秒】`)
        return _.filter(finalRes, (i) => {
            return i.betCount > 0
        })
    }

    /**
     * 根据游戏局表，汇总报表统计
     * @param {*} inparam 
     */
    async calcPlayerRound(inparam) {
        let self = this
        let userName = inparam.userName
        let createdAt = inparam.createdAt
        let gameType = inparam.gameType
        let gameTypeObj = inparam.gameTypeObj
        return new Promise(async function (resolve, reject) {
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
            let p0 = null
            let p1 = null
            let p2 = null
            let p3 = null
            let promiseArr = []
            let roundDayArr = []
            let roundArr = []
            // 长延时游戏，直接查询局表
            let gameTypeObj1 = {}
            let gameTypeObj2 = {}
            for (let key in gameTypeObj) {
                if (key == ':1100000') {
                    gameTypeObj1[key] = gameTypeObj[key]    // 只包含长延时类型游戏
                } else {
                    gameTypeObj2[key] = gameTypeObj[key]    // 只包含非长延时类型游戏
                }
            }
            if (!_.isEmpty(gameTypeObj1)) {
                p0 = self.calcPlayerInterval({ userName, gameType, gameTypeObj: gameTypeObj1, createdAt })
            }
            if (!_.isEmpty(gameTypeObj2)) {
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
                    // console.log(`时间【${new Date().getTime()}】玩家【${userName}】查询汇总局-天表开始：${startDay}-${endDay}`)
                    let query = {
                        ProjectionExpression: 'userId,userName,betCount,betAmount,retAmount,winAmount,refundAmount,winloseAmount,mixAmount,gameTypeData',
                        KeyConditionExpression: 'userName = :userName AND createdDate between :createdAt0 AND :createdAt1',
                        ExpressionAttributeValues: {
                            ':userName': userName,
                            ':createdAt0': startDay,
                            ':createdAt1': endDay,
                        }
                    }
                    // 总报表需要多查询gameType字段
                    gameType instanceof Array ? query.ProjectionExpression += ',gameType' : null
                    p3 = self.queryOnce(query)
                }
                // 查询首天
                if (isQueryFirstDay) {
                    // console.log(`时间【${new Date().getTime()}】玩家【${userName}】查询汇总局表开始：${firstTime[0]}-${firstTime[1]}`)
                    p1 = self.calcPlayerInterval({ userName, gameType, gameTypeObj: gameTypeObj2, createdAt: firstTime })
                }
                // 查询尾天
                if (isQueryLastDay) {
                    if (startDateStr != endDateStr) {
                        // console.log(`时间【${new Date().getTime()}】玩家【${userName}】查询汇总局表开始：${lastTime[0]}-${lastTime[1]}`)
                        p2 = self.calcPlayerInterval({ userName, gameType, gameTypeObj: gameTypeObj2, createdAt: lastTime })
                    }
                }
            }
            // 组装promiseArr并发查询
            if (p0) {
                promiseArr.push(p0)
            }
            if (p1) {
                promiseArr.push(p1)
            }
            if (p2) {
                promiseArr.push(p2)
            }
            if (p3) {
                promiseArr.push(p3)
            }
            let start = Date.now()
            let res = await Promise.all(promiseArr)
            let end = Date.now()
            console.log(`单个玩家${userName}查询局表耗时【${end - start}毫秒】`)
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
            // 初始化最终结果数据
            let betCount = 0
            let betAmount = 0.0
            let retAmount = 0.0
            let winAmount = 0.0
            let refundAmount = 0.0
            let winloseAmount = 0.0
            let mixAmount = 0.0
            let gameTypeMap = {}
            // 合并局天表中所有数据
            for (let item of roundDayArr) {
                for (let gameTypeItem of item.gameTypeData) {
                    if (gameTypeObj[`:${gameTypeItem.gameType}`]) {
                        betCount += gameTypeItem.betCount
                        betAmount += gameTypeItem.betAmount
                        retAmount += gameTypeItem.retAmount
                        winAmount += gameTypeItem.winAmount
                        refundAmount += gameTypeItem.refundAmount
                        winloseAmount += gameTypeItem.winloseAmount
                        // 非真人类游戏，洗码量=投注量
                        if (self.isCalcMixAmount(gameTypeObj[`:${gameTypeItem.gameType}`])) {
                            mixAmount += gameTypeItem.mixAmount
                        } else {
                            mixAmount += Math.abs(gameTypeItem.betAmount)
                        }
                        if (gameType instanceof Array) {
                            self.genGameTypeMap(gameTypeMap, gameTypeItem)
                        } else {
                            break
                        }
                    }
                }
            }
            // 合并局表中所有数据
            for (let round of roundArr) {
                betCount += round.betCount
                betAmount += round.betAmount
                retAmount += round.retAmount
                winAmount += round.winAmount
                refundAmount += round.refundAmount
                winloseAmount += round.winloseAmount
                // 非真人类游戏，洗码量=投注量
                if (self.isCalcMixAmount(round.gameType)) {
                    mixAmount += round.mixAmount
                } else {
                    mixAmount += Math.abs(round.betAmount)
                }
                gameType instanceof Array ? self.genGameTypeMap(gameTypeMap, round) : null
            }
            let playerRes = {
                userName: userName,
                betCount: betCount,
                betAmount: Math.abs(+betAmount.toFixed(4)),
                retAmount: +retAmount.toFixed(4),
                winAmount: +winAmount.toFixed(4),
                refundAmount: +refundAmount.toFixed(4),
                winloseAmount: +winloseAmount.toFixed(4),
                mixAmount: Math.abs(+mixAmount.toFixed(4)),
                gameTypeMap
            }
            return resolve(playerRes)
        })
    }

    /**
     * 查询玩家间隔时间段的内的局汇总
     * @param {*} inparam 
     */
    async calcPlayerInterval(inparam) {
        let self = this
        return new Promise(async function (resolve, reject) {
            let query = {
                TableName: GlobalConfig.TABLE_NAMES.StatRound,
                IndexName: 'UserNameIndex',
                ProjectionExpression: 'userId,userName,betCount,betAmount,retAmount,winAmount,refundAmount,winloseAmount,mixAmount',
                KeyConditionExpression: 'userName = :userName AND createdAt between :createdAt0 AND :createdAt1',
                FilterExpression: `gameType IN (${Object.keys(inparam.gameTypeObj)})`,
                ExpressionAttributeValues: {
                    ':userName': inparam.userName,
                    ':createdAt0': parseInt(inparam.createdAt[0]),
                    ':createdAt1': parseInt(inparam.createdAt[1]),
                    ...inparam.gameTypeObj
                }
            }
            // 总报表需要多查询gameType字段
            inparam.gameType instanceof Array ? query.ProjectionExpression += ',gameType' : null
            self.query(query).then((resArr) => {
                resolve(resArr)
            }).catch((err) => {
                reject(err)
            })
        })
    }

    /**
     * 计算玩家账单流水
     * @param {*} inparam 
     */
    async calcPlayerBill(inparam) {
        let self = this
        return new Promise(function (resolve, reject) {
            // console.log(`时间【${new Date().getTime()}】玩家【${inparam.userName}】查询流水表开始：${inparam.createdAt[0]}-${inparam.createdAt[1]}`)
            let query = {
                TableName: GlobalConfig.TABLE_NAMES.PlayerBillDetail,
                IndexName: 'UserNameIndex',
                ProjectionExpression: 'amount',
                KeyConditionExpression: '#userName = :userName AND createdAt between :createdAt0 AND :createdAt1',
                FilterExpression: `#gameType IN (${Object.keys(inparam.gameTypeObj)})`,
                ExpressionAttributeNames: {
                    '#userName': 'userName',
                    '#gameType': 'gameType'
                },
                ExpressionAttributeValues: {
                    ':userName': inparam.userName,
                    ':createdAt0': parseInt(inparam.createdAt[0]),
                    ':createdAt1': parseInt(inparam.createdAt[1]),
                    ...inparam.gameTypeObj
                }
            }
            // 总报表需要多查询gameType字段
            inparam.gameType instanceof Array ? query.ProjectionExpression += ',gameType' : null
            self.query(query).then((resArr) => {
                // console.log(`时间【${new Date().getTime()}】玩家【${inparam.userName}】查询流水数量【${resArr.Items.length}】`)
                let betCount = 0            // 次数
                let betAmount = 0.0         // 金额
                for (let item of resArr.Items) {
                    betCount++
                    betAmount += item.amount
                }
                resolve({ userName: inparam.userName, betCount, betAmount: Math.abs(betAmount) })
            }).catch((err) => {
                reject(err)
            })
        })
    }

    /**
     * 通过父级查询玩家统计
     * @param {*} inparam 
     */
    async calcParentPlayerStat(inparam) {
        let self = this
        let parent = inparam.parent
        let createdAt = inparam.query.createdAt
        let gameType = inparam.gameType
        let gameTypeObj = inparam.gameTypeObj
        // 商城直接从流水查询返回
        if (gameType == 3) {
            return self.calcParentPlayerBill({ parent, gameType, gameTypeObj, createdAt })
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
        let p0 = null
        let p1 = null
        let p2 = null
        let p3 = null
        let promiseArr = []
        let roundDayArr = []
        let roundArr = []
        // 长延时游戏，直接查询局表
        let gameTypeObj1 = {}
        let gameTypeObj2 = {}
        for (let key in gameTypeObj) {
            if (key == ':1100000') {
                gameTypeObj1[key] = gameTypeObj[key]    // 只包含长延时类型游戏
            } else {
                gameTypeObj2[key] = gameTypeObj[key]    // 只包含非长延时类型游戏
            }
        }
        if (!_.isEmpty(gameTypeObj1)) {
            p0 = self.calcParentPlayerInterval({ parent, gameType, gameTypeObj: gameTypeObj1, createdAt })
        }
        if (!_.isEmpty(gameTypeObj2)) {
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
                console.log(`时间【${new Date().getTime()}】父级【${parent}】查询汇总局-天表开始：${startDay}-${endDay}`)
                let query = {
                    IndexName: 'ParentIndex',
                    ProjectionExpression: 'parent,userId,userName,betCount,betAmount,retAmount,winAmount,refundAmount,winloseAmount,mixAmount,gameTypeData',
                    KeyConditionExpression: 'parent = :parent AND createdDate between :createdAt0 AND :createdAt1',
                    ExpressionAttributeValues: {
                        ':parent': parent,
                        ':createdAt0': startDay,
                        ':createdAt1': endDay,
                    }
                }
                p3 = self.queryOnce(query)
            }
            // 查询首天
            if (isQueryFirstDay) {
                console.log(`时间【${new Date().getTime()}】父级【${parent}】查询首天开始：${firstTime[0]}-${firstTime[1]}`)
                p1 = self.calcParentPlayerInterval({ parent, gameType, gameTypeObj: gameTypeObj2, createdAt: firstTime })
            }
            // 查询尾天
            if (isQueryLastDay) {
                if (startDateStr != endDateStr) {
                    console.log(`时间【${new Date().getTime()}】父级【${parent}】查询尾天开始：${lastTime[0]}-${lastTime[1]}`)
                    p2 = self.calcParentPlayerInterval({ parent, gameType, gameTypeObj: gameTypeObj2, createdAt: lastTime })
                }
            }
        }
        // 组装promiseArr并发查询
        if (p0) {
            promiseArr.push(p0)
        }
        if (p1) {
            promiseArr.push(p1)
        }
        if (p2) {
            promiseArr.push(p2)
        }
        if (p3) {
            promiseArr.push(p3)
        }
        let start = Date.now()
        let res = await Promise.all(promiseArr)
        let end = Date.now()
        console.log(`单个父级${parent}查询局表耗时【${end - start}毫秒】`)
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
        // 初始化最终结果数据
        let betCount = 0
        let betAmount = 0.0
        let retAmount = 0.0
        let winAmount = 0.0
        let refundAmount = 0.0
        let winloseAmount = 0.0
        let mixAmount = 0.0
        let gameTypeMap = {}
        // 合并局天表中所有数据
        for (let item of roundDayArr) {
            for (let gameTypeItem of item.gameTypeData) {
                if (gameTypeObj[`:${gameTypeItem.gameType}`]) {
                    betCount += gameTypeItem.betCount
                    betAmount += gameTypeItem.betAmount
                    retAmount += gameTypeItem.retAmount
                    winAmount += gameTypeItem.winAmount
                    refundAmount += gameTypeItem.refundAmount
                    winloseAmount += gameTypeItem.winloseAmount
                    // 非真人类游戏，洗码量=投注量
                    if (this.isCalcMixAmount(gameTypeObj[`:${gameTypeItem.gameType}`])) {
                        mixAmount += gameTypeItem.mixAmount
                    } else {
                        mixAmount += Math.abs(gameTypeItem.betAmount)
                    }
                    if (gameType instanceof Array) {
                        self.genGameTypeMap(gameTypeMap, gameTypeItem)
                    } else {
                        break
                    }
                }
            }
        }
        // 合并局表中所有数据
        for (let round of roundArr) {
            betCount += round.betCount
            betAmount += round.betAmount
            retAmount += round.retAmount
            winAmount += round.winAmount
            refundAmount += round.refundAmount
            winloseAmount += round.winloseAmount
            // 非真人类游戏，洗码量=投注量
            if (this.isCalcMixAmount(round.gameType)) {
                mixAmount += round.mixAmount
            } else {
                mixAmount += Math.abs(round.betAmount)
            }
            gameType instanceof Array ? self.genGameTypeMap(gameTypeMap, round) : null
        }

        return {
            userId: parent,
            betCount: betCount,
            betAmount: Math.abs(+betAmount.toFixed(4)),
            retAmount: +retAmount.toFixed(4),
            winAmount: +winAmount.toFixed(4),
            refundAmount: +refundAmount.toFixed(4),
            winloseAmount: +winloseAmount.toFixed(4),
            mixAmount: Math.abs(+mixAmount.toFixed(4)),
            gameTypeMap
        }
    }

    /**
     * 查询父级对应所有玩家间隔时间段的内的局汇总
     * @param {*} inparam 
     */
    async calcParentPlayerInterval(inparam) {
        let self = this
        return new Promise(async function (resolve, reject) {
            let query = {
                TableName: GlobalConfig.TABLE_NAMES.StatRound,
                IndexName: 'ParentIndex',
                ProjectionExpression: 'parent,userId,userName,betCount,betAmount,retAmount,winAmount,refundAmount,winloseAmount,mixAmount',
                KeyConditionExpression: 'parent = :parent AND createdAt between :createdAt0 AND :createdAt1',
                FilterExpression: `gameType IN (${Object.keys(inparam.gameTypeObj)})`,
                ExpressionAttributeValues: {
                    ':parent': inparam.parent,
                    ':createdAt0': parseInt(inparam.createdAt[0]),
                    ':createdAt1': parseInt(inparam.createdAt[1]),
                    ...inparam.gameTypeObj
                }
            }
            // 总报表需要多查询gameType字段
            inparam.gameType instanceof Array ? query.ProjectionExpression += ',gameType' : null
            self.query(query).then((resArr) => {
                resolve(resArr)
            }).catch((err) => {
                reject(err)
            })
        })
    }

    /**
     * 计算父级所有玩家账单流水
     * @param {*} inparam 
     */
    async calcParentPlayerBill(inparam) {
        let self = this
        return new Promise(function (resolve, reject) {
            console.log(`时间【${new Date().getTime()}】父级【${inparam.parent}】查询流水表开始：${inparam.createdAt[0]}-${inparam.createdAt[1]}`)
            let query = {
                TableName: GlobalConfig.TABLE_NAMES.PlayerBillDetail,
                IndexName: 'ParentIndex',
                ProjectionExpression: 'amount',
                KeyConditionExpression: '#parent = :parent AND createdAt between :createdAt0 AND :createdAt1',
                FilterExpression: `#gameType IN (${Object.keys(inparam.gameTypeObj)})`,
                ExpressionAttributeNames: {
                    '#parent': 'parent',
                    '#gameType': 'gameType'
                },
                ExpressionAttributeValues: {
                    ':parent': inparam.parent,
                    ':createdAt0': parseInt(inparam.createdAt[0]),
                    ':createdAt1': parseInt(inparam.createdAt[1]),
                    ...inparam.gameTypeObj
                }
            }
            // 总报表需要多查询gameType字段
            inparam.gameType instanceof Array ? query.ProjectionExpression += ',gameType' : null
            self.query(query).then((resArr) => {
                console.log(`时间【${new Date().getTime()}】父级【${inparam.parent}】查询流水数量【${resArr.Items.length}】`)
                let betCount = 0            // 次数
                let betAmount = 0.0         // 金额
                for (let item of resArr.Items) {
                    betCount++
                    betAmount += item.amount
                }
                resolve({ userId: inparam.parent, betCount, betAmount: Math.abs(betAmount) })
            }).catch((err) => {
                reject(err)
            })
        })
    }

    /**
     * 组装每款游戏的数据
     * @param {*} gameTypeMap 
     * @param {*} inparam 
     */
    genGameTypeMap(gameTypeMap, inparam) {
        if (!gameTypeMap[inparam.gameType]) {
            gameTypeMap[inparam.gameType] = {}
            gameTypeMap[inparam.gameType].betCount = 0
            gameTypeMap[inparam.gameType].betAmount = 0.0
            gameTypeMap[inparam.gameType].retAmount = 0.0
            gameTypeMap[inparam.gameType].winAmount = 0.0
            gameTypeMap[inparam.gameType].refundAmount = 0.0
            gameTypeMap[inparam.gameType].winloseAmount = 0.0
            gameTypeMap[inparam.gameType].mixAmount = 0.0
        }
        gameTypeMap[inparam.gameType].betCount += inparam.betCount
        gameTypeMap[inparam.gameType].betAmount += inparam.betAmount
        gameTypeMap[inparam.gameType].retAmount += inparam.retAmount
        gameTypeMap[inparam.gameType].winAmount += inparam.winAmount
        gameTypeMap[inparam.gameType].refundAmount += inparam.refundAmount
        gameTypeMap[inparam.gameType].winloseAmount += inparam.winloseAmount
        // 非真人类游戏，洗码量=投注量
        if (this.isCalcMixAmount(inparam.gameType)) {
            gameTypeMap[inparam.gameType].mixAmount += inparam.mixAmount
        } else {
            gameTypeMap[inparam.gameType].mixAmount += Math.abs(inparam.betAmount)
        }
    }
    /**
     * 是否计算洗码量
     */
    isCalcMixAmount(gameType) {
        if (gameType != 30000 && gameType != 1050000 && gameType != 1060000) {
            return false
        }
        return true
    }
}

module.exports = PlayerBillModel