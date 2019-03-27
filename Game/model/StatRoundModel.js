const Tables = require('../lib/Dynamo').Tables
const BaseModel = require('./BaseModel')
const _ = require('lodash')

module.exports = class StatRoundModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.StatRound,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    // 批量写入局表
    batchWriteRound(roundAll) {
        let promiseArr = []
        if (!roundAll || roundAll.length == 0) {
            return promiseArr
        }
        let chunkRound = _.chunk(roundAll, 25)
        // console.log(`总共需要${roundAll.length}数据条目批量写入`)
        // console.log(`总共需要${chunkRound.length}次批量写入`)
        for (let chunk of chunkRound) {
            let batch = { RequestItems: {} }
            batch.RequestItems[Tables.StatRound] = []
            for (let item of chunk) {
                batch.RequestItems[Tables.StatRound].push({
                    PutRequest: {
                        Item: item
                    }
                })
            }
            // 数据存在时，写入数据库
            if (batch.RequestItems[Tables.StatRound].length > 0) {
                let p = this.batchWrite(batch)
                promiseArr.push(p)
            }
        }
        return promiseArr
    }

    // 查询指定日期的数据
    async queryDate(inparam) {
        let query = {
            IndexName: 'CreatedDateIndex',
            KeyConditionExpression: 'createdDate = :createdDate',
            ProjectionExpression: 'betAmount,retAmount,winAmount,refundAmount,winloseAmount,mixAmount,userId,userName,createdDate,gameType,betCount,parent',
            FilterExpression: 'gameType <> :longTimeGameType1',
            ExpressionAttributeValues: {
                ':createdDate': inparam.lastDayTime,
                ':longTimeGameType1': 1100000   // UG体育游戏排除
            }
        }
        // 只有重置初始局天表才统计YSB体育游戏
        if (!inparam.isInit) {
            query.FilterExpression += ' AND gameType <> :longTimeGameType2'
            query.ExpressionAttributeValues[':longTimeGameType2'] = 1130000
        }
        const [err, ret] = await this.query(query)
        return [0, ret]
    }

    //查询bk对应的数量
    async bkQuery(inparam) {
        const [bkErr, bkRet] = await this.query({
            KeyConditionExpression: 'businessKey = :businessKey',
            ExpressionAttributeValues: {
                ':businessKey': inparam.bk
            }
        })
        let betNum = 0, retNum = 0
        if (bkRet && bkRet.Items.length > 0 && bkRet.Items[0].content) {
            betNum = bkRet.Items[0].content.bet.length
            retNum = bkRet.Items[0].content.ret.length
        }
        return betNum + retNum
    }

    //查询bk对应的AnotherGameDate是否存在
    async isAnotherGameDate(inparam) {
        const [bkErr, bkRet] = await this.query({
            KeyConditionExpression: 'businessKey = :businessKey',
            ExpressionAttributeValues: {
                ':businessKey': inparam.bk
            }
        })
        let flag = false
        // 查询是否有战绩
        if (bkRet && bkRet.Items.length > 0) {
            let anotherGameData = bkRet.Items[0].anotherGameData
            if (anotherGameData && anotherGameData != 'NULL!') {
                flag = true
            }
        }
        // 查询是否有退款
        if (bkRet && bkRet.Items.length > 0) {
            let betCount = bkRet.Items[0].content.bet.length
            let refundCount = 0
            let retArr = bkRet.Items[0].content.ret
            for (let ret of retArr) {
                if (ret.type == 5) {
                    refundCount++
                }
            }
            if (betCount == refundCount) {
                flag = true
            }
        }
        return flag
    }

    // 更新第三方游戏数据（UG）
    async updateAnotherGameData(businessKey, anotherGameData) {
        new StatRoundModel().updateItem({
            Key: { 'businessKey': businessKey },
            UpdateExpression: 'SET anotherGameData=:anotherGameData',
            ExpressionAttributeValues: {
                ':anotherGameData': anotherGameData
            }
        })
    }
}


