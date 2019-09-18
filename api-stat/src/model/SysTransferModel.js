const Tables = require('../lib/Model').Tables
const GameTypeEnum = require('../lib/Model').GameTypeEnum
const BaseModel = require('./BaseModel')
const _ = require('lodash')
const axios = require('axios')
class SysTransferModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.SYSTransfer,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    //查询流水返回map统计
    async queryDetail(user, startTime, endTime) {
        let query = {
            IndexName: 'PlatIndex',
            KeyConditionExpression: 'plat = :plat AND createdAt between :createdAt0 and :createdAt1',
            ProjectionExpression: 'amount,sn,businessKey,createdAt,gameType,gameId,balance,plat,#status,#type,userId,userNick',
            ExpressionAttributeNames: {
                '#status': 'status',
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':plat': user.sn,
                ':createdAt0': startTime,
                ':createdAt1': endTime
            }
        }
        let detailRes = await this.query(query)
        let gameTypeGroup = _.groupBy(detailRes.Items, 'gameType') //游戏大类分组
        for (let gameType in gameTypeGroup) {
            let initGameType = GameTypeEnum[gameType.toString()]
            if (!user.transferMap[gameType]) {
                user.transferMap[gameType] = { ...initGameType, topAmount: 0, mixAmountMap: { mixAmount: 0.0 }, winloseAmountMap: { winloseAmount: 0.0 }, betAmountMap: { betAmount: 0.0, betCount: 0 } }
            }
            let betAmount = 0                       //下注金额
            let retAmount = 0                       //返回金额
            let winAmount = 0                       //返奖金额
            let refundAmount = 0                    //退回金额
            let mixAmount = 0                       //洗码量
            let winloseAmount = 0                   //纯利润
            let betCount = 0
            for (let item of gameTypeGroup[gameType]) {
                if (item.type == 3) {
                    betAmount += item.amount
                    betCount++
                } else if (item.type == 4) {
                    winAmount += item.amount
                } else if (item.type == 5) {
                    refundAmount += item.amount
                }
            }
            retAmount = winAmount + refundAmount
            winloseAmount = betAmount + retAmount
            mixAmount = Math.min(Math.abs(betAmount), Math.abs(winloseAmount))
            user.transferMap[gameType].betAmountMap.betCount += betCount
            user.transferMap[gameType].mixAmountMap.mixAmount = parseFloat((user.transferMap[gameType].mixAmountMap.mixAmount + mixAmount).toFixed(2))
            user.transferMap[gameType].betAmountMap.betAmount = parseFloat((user.transferMap[gameType].betAmountMap.betAmount + betAmount).toFixed(2))
            //许宇帅要求这里的winloseAmount要求*-1
            user.transferMap[gameType].winloseAmountMap.winloseAmount = parseFloat((user.transferMap[gameType].winloseAmountMap.winloseAmount + winloseAmount).toFixed(2) * -1)
        }
        return user
    }

    // 重推
    async repush() {
        let promiseArr = []
        // 所有超时记录
        promiseArr.push(this.query({
            IndexName: 'StatusIndex',
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':status': 'E', }
        }))
        // 所有返还的失败记录
        promiseArr.push(this.query({
            IndexName: 'StatusIndex',
            KeyConditionExpression: '#status = :status AND createdAt between :createdAt0 and :createdAt1',
            // FilterExpression: '#type <> :type',
            // ExpressionAttributeNames: { '#status': 'status', '#type': 'type' },
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':status': 'N',
                // ':type': 3,
                ':createdAt0': Date.now() - 3600 * 1000,
                ':createdAt1': Date.now() + 3600 * 1000
            }
        }))
        let resArr = await Promise.all(promiseArr)
        let repushArr = resArr[0].Items.concat(resArr[1].Items)
        // 重推所有超时和返还失败记录
        for (let record of repushArr) {
            console.log(`免转重推数量：${repushArr.length}`)
            try {
                let platRes = await axios.post(record.transferURL, record.repush, { timeout: 10 * 1000 })
                if (platRes.data.code == 0 && !isNaN(parseFloat(platRes.data.balance))) {
                    record.status = 'Y'
                    await this.putItem(record)
                } else {
                    record.status = 'N'
                    await this.putItem(record)
                }
            } catch (error) {
                console.error('自动重推超时')
                console.error(error)
            }
        }
    }
}


module.exports = SysTransferModel