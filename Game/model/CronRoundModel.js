const { Tables, Model, RoleCodeEnum } = require('../lib/Dynamo')
const BaseModel = require('./BaseModel')
const ConfigModel = require('./ConfigModel')
const StatRoundModel = require('./StatRoundModel')
const HeraGameRecordModel = require('./HeraGameRecordModel')
const LogModel = require('./LogModel')
const moment = require('moment')
const axios = require('axios')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
const NP = require('number-precision')

module.exports = class CronRoundModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.PlayerBillDetail,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    /**
     * 统计时间范围内的局表
     */
    async cronLast() {
        const statRoundModel = new StatRoundModel()
        const heraGameRecordModel = new HeraGameRecordModel()
        // 1，从配置文件中获取最后一条记录时间
        const queryRet = await new ConfigModel().queryLastTime({ code: 'roundLast' })
        let maxRoundTime = queryRet.maxRoundTime ? queryRet.maxRoundTime : 120000       // 获取游戏回合最大时间，默认2分钟
        let beginTime = queryRet.lastTime ? queryRet.lastTime + 1 : 0                   // 开始统计时间，加1毫秒保证不重复统计
        let endTime = Date.now() - maxRoundTime                                         // 结束统计时间
        let self = this                                                                 // 自身对象
        console.log(`查询时间范围：${beginTime}-${endTime}，${moment(beginTime).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}至${moment(endTime).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}`)
        // 2，查询时间范围内所有下注数据
        const billRet = await self.queryType({ type: 3, beginTime, endTime })
        let userAnotherGameData = await self.getSAAnotherGamedata(billRet)
        // 3，按照bk分组，遍历分组结果，根据回合时间查询其返回，组装每一局，最后并发执行
        let promiseArr = await self.getRoundAll(_.uniqBy(billRet.Items, 'businessKey'), userAnotherGameData)
        let roundAll = await Promise.all(promiseArr)
        // 4，组装，批量写入局表和战绩表
        let p1Arr = statRoundModel.batchWriteRound(roundAll)
        let p2Arr = heraGameRecordModel.batchWriteRound(roundAll,beginTime,endTime)
        await Promise.all(p1Arr.concat(p2Arr))
        // 5，成功后配置文件记录当前时间
        queryRet.lastTime = endTime
        await new ConfigModel().putItem(queryRet)
        console.log(`更新配置成功`)
        // 6，请求执行金额Map统计
        this.axiosCron({ methodName: 'cronAmountMap' })
        // 7,请求执行接入方金额Map统计
        this.axiosCron({ methodName: 'cronTransferMap' })
    }

    // 内部方法0：查询一段时间的type的数据
    async queryType(inparam) {
        let query = {
            IndexName: 'TypeIndex',
            KeyConditionExpression: '#type = :type AND createdAt between :createdAt0  and :createdAt1',
            ProjectionExpression: 'gameType,userId,businessKey,createdAt',
            // ProjectionExpression: 'amount,businessKey,#type,parent,userName,createdAt,userId,gameType,gameId,roundId,originalAmount,sn,balance,anotherGameData',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':type': inparam.type,
                ':createdAt0': inparam.beginTime,
                ':createdAt1': inparam.endTime
            }
        }
        // 非修正情况下排除【触发成局】的游戏
        if (!inparam.isFix) {
            query.FilterExpression = 'gameType <> :longTimeGameType1 AND gameType <> :longTimeGameType2 AND gameType <> :longTimeGameType3'
            // query.ExpressionAttributeValues[':longTimeGameType1'] = 1100000 // UG体育游戏排除
            query.ExpressionAttributeValues[':longTimeGameType1'] = 60000   // NA捕鱼游戏排除
            query.ExpressionAttributeValues[':longTimeGameType2'] = 1110000 // SA捕鱼游戏排除
            query.ExpressionAttributeValues[':longTimeGameType3'] = 1130000 // YSB体育游戏排除
        }
        const ret = await this.query(query)
        console.log(`【${inparam.beginTime}-${inparam.endTime}】下注总条数：${ret.Items.length}`)
        return ret
    }

    // 内部方法1：组装局列表
    async getRoundAll(bkObjArr, userAnotherGameData) {
        let self = this
        let promiseArr = []                                 // 所有需要执行的Promise
        for (let bkObj of bkObjArr) {
            let bk = bkObj.businessKey
            let p = new Promise(async function (resolve, reject) {
                let betArr = []                             //下注流水数组
                let retArr = []                             //返回流水数组
                let betCount = 0                            //下注次数
                let betAmount = 0                           //下注金额
                let retAmount = 0                           //返回金额
                let winAmount = 0                           //返奖金额
                let refundAmount = 0                        //退回金额
                let mixAmount = 0                           //洗码量
                let winloseAmount = 0                       //纯利润
                let anotherGameData = { bet: [], ret: [] }  //第三方游戏数据
                // 查询相同BK的所有流水
                const bkRet = await self.queryBk({ bk })
                // 获取单局最早的下注时间
                let firstBetItem = _.minBy(bkRet, 'createdAt')
                let betTimeStart = firstBetItem.createdAt
                let originalAmount = firstBetItem.originalAmount
                let createdStr = moment(betTimeStart).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
                let createdDate = parseInt(moment(betTimeStart).utcOffset(8).format('YYYYMMDD'))
                // 统计相同BK的各种金额
                for (let billItem of bkRet) {
                    // 下注
                    if (billItem.type == 3) {
                        betAmount = NP.plus(betAmount, billItem.amount)
                        if (billItem.gameType == 1050000) {                      // AG真人游戏处理
                            anotherGameData.bet.push(billItem.anotherGameData)
                        }
                        betCount++
                        betArr.push(billItem)
                    }
                    // 返奖
                    else if (billItem.type == 4) {
                        winAmount = NP.plus(winAmount, billItem.amount)
                    }
                    // 退款
                    else if (billItem.type == 5) {
                        refundAmount = NP.plus(refundAmount, billItem.amount)
                    }
                    // 返还
                    if (billItem.type != 3) {
                        if (billItem.gameType == 1050000) {
                            anotherGameData.ret.push(billItem.anotherGameData)   // AG真人游戏处理
                        }
                        retArr.push(billItem)
                    }
                }
                retAmount = NP.plus(winAmount, refundAmount)
                winloseAmount = NP.plus(betAmount, retAmount)
                mixAmount = Math.min(Math.abs(betAmount), Math.abs(winloseAmount))
                // 第三方游戏详细数据获取，每条下注都需要请求获取（NA真人游戏处理,YSB体育游戏处理）
                if (firstBetItem.gameType == 30000 || firstBetItem.gameType == 1130000) {
                    anotherGameData = await self.getAnotherGamedata(firstBetItem)
                    mixAmount = firstBetItem.gameType != 1130000 && anotherGameData ? anotherGameData.mixAmount : mixAmount
                }
                // SA真人游戏
                if (firstBetItem.gameType == 1060000 && userAnotherGameData[bkObj.userId]) {
                    anotherGameData = userAnotherGameData[bkObj.userId][bkObj.businessKey]
                    mixAmount = anotherGameData ? anotherGameData.mixAmount : mixAmount
                }
                if (!anotherGameData || (anotherGameData.bet && anotherGameData.bet.length == 0)) {
                    anotherGameData = Model.StringValue
                }
                // 组装单局数据
                resolve({
                    businessKey: bk,
                    parent: firstBetItem.parent || Model.StringValue,
                    userName: firstBetItem.userName,
                    userId: +firstBetItem.userId,
                    createdAt: betTimeStart,
                    createdDate: createdDate,
                    createdStr: createdStr,
                    betCount: betCount,
                    originalAmount: originalAmount,
                    betAmount: betAmount,
                    retAmount: retAmount,
                    winAmount: winAmount,
                    refundAmount: refundAmount,
                    winloseAmount: winloseAmount,
                    mixAmount: mixAmount,
                    gameType: +firstBetItem.gameType,
                    gameId: firstBetItem.gameId ? +firstBetItem.gameId : +firstBetItem.gameType,
                    roundId: firstBetItem.roundId,
                    content: { bet: betArr, ret: retArr },
                    anotherGameData: anotherGameData
                })
            })
            promiseArr.push(p)
        }
        return promiseArr
    }

    // 内部方法2：查询bk对应的type的数据
    async queryBk(inparam) {
        const ret = await this.query({
            IndexName: 'BusinessKeyIndex',
            KeyConditionExpression: 'businessKey=:businessKey',
            ProjectionExpression: 'amount,businessKey,#type,parent,userName,createdAt,userId,gameType,gameId,roundId,originalAmount,sn,balance,anotherGameData',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':businessKey': inparam.bk
            }
        })
        return ret.Items
    }

    // 内部方法3：获取第三方游戏数据
    async getAnotherGamedata(betItem) {
        try {
            // YSB体育游戏
            if (betItem.gameType == 1130000) {
                return betItem.anotherGameData
            }
            // NA真人
            if (betItem.gameType == 30000) {
                let gameRecordRes = await new HeraGameRecordModel().queryOnce({
                    KeyConditionExpression: 'userName=:userName AND betId=:betId',
                    ExpressionAttributeValues: {
                        ':userName': betItem.userName,
                        ':betId': betItem.businessKey
                    }
                })
                if (gameRecordRes && gameRecordRes.Items && gameRecordRes.Items.length > 0 && gameRecordRes.Items[0].record) {
                    let gameRecord = gameRecordRes.Items[0].record
                    return { mixAmount: +gameRecord.validAmount, data: JSON.stringify(gameRecord) }
                } else {
                    new LogModel().add('4', null, betItem)
                    return null
                }
            }
        } catch (error) {
            console.error('第三方游戏数据获取发生服务响应异常')
            console.error(error)
            new LogModel().add('4', error, betItem)
        }
    }

    // 内部方法4：获取SA游戏数据
    async getSAAnotherGamedata(billRet) {
        try {
            let userAnotherGameData = {}
            // 过滤SA真人游戏数据
            let saBillItems = billRet.Items.filter((item) => {
                if (item.gameType == 1060000) {
                    return item
                }
            })
            // 按照玩家分组
            let saGroupRet = _.groupBy(saBillItems, 'userId')
            // 获取每个玩家的SA数据
            for (let userId in saGroupRet) {
                // await this.waitASecond()
                userAnotherGameData[userId] = {}
                axios.defaults.timeout = 60000
                const res = await axios.post(`https://${process.env.ANOTHER_GAME_CENTER}/sa/betdetail`, {
                    userId: userId.toString(),
                    fromTime: moment(_.minBy(saGroupRet[userId], 'createdAt').createdAt).utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
                    toTime: moment(_.maxBy(saGroupRet[userId], 'createdAt').createdAt + 600000).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
                })
                // 遍历NA玩家的每条下注
                for (let betItem of saGroupRet[userId]) {
                    let anotherGameBetArr = []  // 第三方游戏所有对应bk的已完成游戏回合
                    let mixAmount = 0           // 第三方游戏洗码量
                    // 遍历SA玩家每条下注
                    for (let item of res.data) {
                        // 如果局号匹配，则该条流水匹配
                        if (item.GameID[0] == betItem.businessKey.substring(betItem.businessKey.lastIndexOf('_') + 1, betItem.businessKey.length)) {
                            mixAmount += parseFloat(item.Rolling[0])
                            anotherGameBetArr.push(item)
                        }
                    }
                    userAnotherGameData[userId][betItem.businessKey] = { mixAmount, data: JSON.stringify(anotherGameBetArr) }
                    // 如果没有查找到，记录LOG报警
                    if (anotherGameBetArr.length == 0) {
                        new LogModel().add('4', null, betItem)
                    }
                }

            }
            return userAnotherGameData
        } catch (error) {
            console.error('第三方游戏数据获取发生服务响应异常')
            console.error(error)
            new LogModel().add('4', error, betItem)
        }
    }

    // 内部方法5：随机等待再查询
    waitASecond() {
        return new Promise((reslove, reject) => {
            setTimeout(function () { reslove('Y') }, _.random(100, 1000))
        })
    }

    /**
     * 内部方法6：请求执行金额map统计
     */
    async axiosCron(inparam) {
        let cronUrl = `https://${process.env.ANOTHER_GAME_CENTER}/stat/${inparam.methodName}`
        console.log(`请求${inparam.methodName}接口【${cronUrl}】`)
        let tokenAdmin = await jwt.sign({
            role: RoleCodeEnum.PlatformAdmin,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) * 3,
            iat: Math.floor(Date.now() / 1000) - 30
        }, process.env.TOKEN_SECRET)
        axios.post(cronUrl, {}, {
            headers: { 'Authorization': `Bearer ${tokenAdmin}` }
        }).then(res => {
            console.log(res.data)
        }).catch(err => {
            console.error(`${inparam.methodName}接口返回异常`)
            console.error(err)
        })
    }
}
