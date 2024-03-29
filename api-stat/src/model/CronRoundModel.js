const { Tables, Model } = require('../lib/Model')
const BaseModel = require('./BaseModel')
const StatRoundModel = require('./StatRoundModel')
const HeraGameRecordModel = require('./HeraGameRecordModel')
const LogModel = require('./LogModel')
const moment = require('moment')
const axios = require('axios')
const _ = require('lodash')
const NP = require('number-precision')
const config = require('config')

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
     * 修正时间范围内的局表
     */
    async fixRound(inparam) {
        const statRoundModel = new StatRoundModel()
        const heraGameRecordModel = new HeraGameRecordModel()
        // 查询时间范围内所有下注数据
        let beginTime = inparam.start                           // 入参起始时间
        let endTime = inparam.end                               // 入参结束时间
        const billRet = await this.queryType({ type: 3, beginTime, endTime, isFix: inparam.isFix })
        console.log(`查询时间范围：${beginTime}-${endTime}，${moment(beginTime).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}至${moment(endTime).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}，下注条目：${billRet.Items.length}`)
        // 额外获取SA游戏记录
        let userAnotherGameData = await this.getSAAnotherGamedata(billRet)
        // 按照bk分组，遍历分组结果，根据回合时间查询其返回，组装每一局，最后并发执行
        let roundAll = await Promise.all(this.getRoundAll(_.uniqBy(billRet.Items, 'businessKey'), userAnotherGameData))
        // 批量写入局表和战绩表
        let p1Arr = statRoundModel.batchWriteRound(roundAll)
        let p2Arr = heraGameRecordModel.batchWriteRound(roundAll)
        await Promise.all(p1Arr.concat(p2Arr))
    }

    // 内部方法0：查询一段时间的type的数据
    queryType(inparam) {
        let query = {
            IndexName: 'TypeIndex',
            KeyConditionExpression: '#type = :type AND createdAt between :createdAt0  and :createdAt1',
            ProjectionExpression: 'gameType,userId,businessKey,createdAt',
            ExpressionAttributeNames: { '#type': 'type' },
            ExpressionAttributeValues: { ':type': inparam.type, ':createdAt0': inparam.beginTime, ':createdAt1': inparam.endTime }
        }
        // 非修正情况下排除【触发成局】的游戏
        if (!inparam.isFix) {
            query.FilterExpression = 'gameType <> :longTimeGameType1 AND gameType <> :longTimeGameType2 AND gameType <> :longTimeGameType3 AND gameType <> :longTimeGameType4 AND gameType <> :longTimeGameType5 AND gameType <> :longTimeGameType6'
            query.ExpressionAttributeValues[':longTimeGameType1'] = 1100000 // VG棋牌游戏排除
            query.ExpressionAttributeValues[':longTimeGameType2'] = 1110000 // SA捕鱼游戏排除
            query.ExpressionAttributeValues[':longTimeGameType3'] = 1130000 // YSB体育游戏排除
            query.ExpressionAttributeValues[':longTimeGameType4'] = 1170000 // DJ电竞游戏排除
            query.ExpressionAttributeValues[':longTimeGameType5'] = 70000   // H5电子排除
            query.ExpressionAttributeValues[':longTimeGameType6'] = 90000   // H5电子-无神秘奖排除
        }
        return this.query(query)
    }

    // 内部方法1：组装局列表
    getRoundAll(bkObjArr, userAnotherGameData) {
        let promiseArr = []                                 // 所有需要执行的Promise
        for (let bkObj of bkObjArr) {
            let bk = bkObj.businessKey
            let p = new Promise(async (resolve, reject) => {
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
                const bkRet = await this.queryBk({ bk })
                // 获取单局最早的下注时间和最晚的派彩时间
                let firstBetItem = _.minBy(bkRet.Items, 'createdAt')
                let lastRetItem = _.maxBy(bkRet.Items, 'createdAt')
                let betTimeStart = firstBetItem.createdAt
                let originalAmount = firstBetItem.originalAmount
                let createdStr = moment(betTimeStart).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
                let createdDate = parseInt(moment(betTimeStart).utcOffset(8).format('YYYYMMDD'))
                // 统计相同BK的各种金额
                for (let billItem of bkRet.Items) {
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
                // 第三方游戏详细数据获取，每条下注都需要请求获取（YSB体育游戏处理）
                if (firstBetItem.gameType == 1130000) {
                    anotherGameData = firstBetItem.anotherGameData
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
                    retAt: lastRetItem.createdAt,
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
    queryBk(inparam) {
        return this.query({
            IndexName: 'BusinessKeyIndex',
            KeyConditionExpression: 'businessKey=:businessKey',
            ProjectionExpression: 'amount,businessKey,#type,parent,userName,createdAt,userId,gameType,gameId,roundId,originalAmount,sn,balance,anotherGameData',
            ExpressionAttributeNames: { '#type': 'type' },
            ExpressionAttributeValues: { ':businessKey': inparam.bk }
        })
    }

    // 内部方法3：获取SA游戏数据
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
                const res = await axios.post(`http://${config.na.ANOTHER_GAME_CENTER}/sa/betdetail`, {
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
                        new LogModel().add('4', 'anotherGameDataError', betItem, null)
                    }
                }

            }
            return userAnotherGameData
        } catch (error) {
            console.error('第三方游戏数据获取发生服务响应异常')
            console.error(error)
            new LogModel().add('4', 'anotherGameDataError', betItem, error)
        }
    }

    // 内部方法4：随机等待再查询
    // waitASecond() {
    //     return new Promise((reslove, reject) => {
    //         setTimeout(function () { reslove('Y') }, _.random(100, 10000))
    //     })
    // }
}
