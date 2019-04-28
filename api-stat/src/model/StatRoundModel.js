const Tables = require('../lib/Model').Tables
const BaseModel = require('./BaseModel')
const _ = require('lodash')

class StatRoundModel extends BaseModel {
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
            batch.RequestItems['StatRound'] = []
            for (let item of chunk) {
                batch.RequestItems['StatRound'].push({
                    PutRequest: {
                        Item: item
                    }
                })
            }
            // 数据存在时，写入数据库
            if (batch.RequestItems['StatRound'].length > 0) {
                let p = this.batchWrite(batch)
                promiseArr.push(p)
            }
        }
        return promiseArr
    }
    /**
     * 查询大于改日期的数据
     */
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
        return await this.query(query)
    }
    /**
     * 查询某个玩家某天的数据
     */
    async queryPlayerDate(inparam) {
        let ret = await this.query({
            IndexName: 'CreatedDateIndex',
            KeyConditionExpression: 'createdDate = :createdDate',
            ProjectionExpression: 'betAmount,retAmount,winAmount,refundAmount,winloseAmount,mixAmount,userId,userName,createdDate,gameType,betCount,parent',
            FilterExpression: 'userName = :userName',
            ExpressionAttributeValues: {
                ':createdDate': inparam.createdDate,
                ':userName': inparam.userName
            }
        })
        return ret
    }

    /**
     * 获取局表指定时间的数据
     */
    async getPlayerRound(inparam) {
        let ret = await this.query({
            IndexName: 'UserNameIndex',
            KeyConditionExpression: 'userName = :userName AND createdAt between :createdAt0 AND :createdAt1',
            ExpressionAttributeValues: {
                ':userName': inparam.userName,
                ':createdAt0': +inparam.createdAt[0],
                ':createdAt1': +inparam.createdAt[1]
            }
        })
        let roundRes = { betAmount: 0, betCount: 0, winAmount: 0 }
        if (ret && ret.Items.length != 0) {
            for (let item of ret.Items) {
                roundRes.betAmount += item.betAmount
                roundRes.betCount += item.betCount
                roundRes.winAmount += item.winAmount
            }
        }
        return roundRes
    }

    /**
     * 更新第三方游戏数据
     * @param {*} businessKey 
     * @param {*} anotherGameData 
     */
    async updateAnotherGameData(businessKey, anotherGameData) {
        new StatRoundModel().updateItem({
            Key: { 'businessKey': businessKey },
            UpdateExpression: 'SET anotherGameData=:anotherGameData',
            ExpressionAttributeValues: {
                ':anotherGameData': anotherGameData
            }
        })
    }

    //查询bk对应的AnotherGameDate是否存在
    async isAnotherGameDate(inparam) {
        const bkRet = await this.query({
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

    //查询指定bk的数据
    async getBkInfo(inparam) {
        let queryData = {
            KeyConditionExpression: 'businessKey = :businessKey',
            ProjectionExpression: 'createdAt',
            ExpressionAttributeValues: {
                ':businessKey': inparam.bk
            }
        }
        if (!inparam.bk) {
            queryData = {
                IndexName: 'ParentIndex',
                KeyConditionExpression: 'parent = :parent AND createdAt between :createdAt0 and :createdAt1',
                ProjectionExpression: 'businessKey,createdAt',
                ExpressionAttributeValues: {
                    ':parent': inparam.parent,
                    ':createdAt0': inparam.start,
                    ':createdAt1': inparam.end
                }
            }
        }
        const bkRet = await this.query(queryData)
        return bkRet.Items
    }
}

module.exports = StatRoundModel


