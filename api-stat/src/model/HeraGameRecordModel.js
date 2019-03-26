const Tables = require('../lib/Model').Tables
const BaseModel = require('./BaseModel')
const _ = require('lodash')
const moment = require('moment')

/**
 * 战绩表实体
 */
class HeraGameRecordModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.HeraGameRecord,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 批量写入第三方游戏汇总数据
     * @param {*} roundAll
     */
    batchWriteRound(roundAll) {
        let promiseArr = []
        if (!roundAll || roundAll.length == 0) {
            return promiseArr
        }
        let chunkRound = _.chunk(roundAll, 25)
        for (let chunk of chunkRound) {
            let batch = { RequestItems: {} }
            batch.RequestItems['HeraGameRecord'] = []
            for (let item of chunk) {
                // 只处理第三方游戏
                if (parseInt(item.gameType) > 100000) {
                    //初始数据
                    // let initObj = {
                    //     bet: Math.abs(item.content.bet[0].amount),                          // 下注金额
                    //     totalGold: 0,                                                       // 返奖金额（默认为零）
                    //     userBalance: item.content.bet[0].balance,                           // 用户余额（默认为没有返奖的）
                    //     preBalance: item.content.bet[0].originalAmount                      // 下注前用户余额
                    // }
                    // if (parseInt(item.gameType) == 1010000 || parseInt(item.gameType) == 10300000) {  // TTG 和 MG 电子游戏
                    //     if (item.content.ret && item.content.ret.length > 0) {
                    //         initObj.totalGold = item.content.ret[0].amount                  // 返奖余额
                    //         initObj.userBalance = item.content.ret[0].balance               // 用户余额（返奖后）
                    //     }
                    // }
                    // 单条战绩
                    let gameRecord = {
                        userId: +item.userId,
                        userName: item.userName,
                        betId: item.businessKey,
                        betTime: +item.createdAt,
                        createdDate: moment(+item.createdAt).utcOffset(8).format('YYYY-MM-DD'),
                        gameId: item.gameId ? item.gameId.toString() : item.gameType.toString(),
                        gameType: +item.gameType,
                        parentId: item.parent,
                        record: {
                            content: item.content,
                            anotherGameData: item.anotherGameData,
                            // gameDetail: JSON.stringify(initObj)
                        }
                    }
                    batch.RequestItems['HeraGameRecord'].push({
                        PutRequest: {
                            Item: gameRecord
                        }
                    })
                }
            }
            // 数据存在时，写入数据库
            if (batch.RequestItems['HeraGameRecord'].length > 0) {
                let p = this.batchWrite(batch)
                promiseArr.push(p)
            }
        }
        return promiseArr
    }

    /**
     * 获取指定玩家一段时间的战绩
     */
    async getPlayerRecord(inparam) {
        let [err, res] = await this.query({
            KeyConditionExpression: 'userName =:userName',
            ProjectionExpression: 'userName,betId,betTime,#record',
            FilterExpression: 'betTime BETWEEN :betTime0 AND :betTime1',
            ExpressionAttributeNames: {
                '#record': 'record'
            },
            ExpressionAttributeValues: {
                ':userName': inparam.userName,
                ':betTime0': +inparam.start,
                ':betTime1': +inparam.end
            }
        })
        if (err) {
            console.log(err)
        }
        return res.Items
    }

    /**
     * 获取时间段的战绩表数据
     */
    async getTimeRecord(userId, inparam) {
        let [err, res] = await this.query({
            IndexName: "parentIdIndex",
            KeyConditionExpression: '#parentId=:parentId AND betTime BETWEEN :betTime0 AND :betTime1',
            ProjectionExpression: 'userName,betId,betTime,#record',
            // FilterExpression: 'gameType <> :gameType1 AND gameType <> :gameType2',
            ExpressionAttributeNames: {
                '#parentId': 'parentId',
                '#record': 'record'
            },
            ExpressionAttributeValues: {
                ':parentId': userId,
                ':betTime0': +inparam.start,
                ':betTime1': +inparam.end
                // ':gameType1': 3,    // 商城的战绩过滤掉
                // ':gameType2': 10000 // 棋牌的战绩过滤掉
            }
        })
        return res.Items
    }

    /**
     * 更新战绩时间
     */
    updateTimeRecord(inparam) {
        return this.updateItem({
            Key: { 'userName': inparam.userName, 'betId': inparam.betId },
            UpdateExpression: 'SET betTime = :betTime,#record = :record',
            ExpressionAttributeNames: {
                '#record': 'record'
            },
            ExpressionAttributeValues: {
                ':betTime': inparam.betTime,
                ':record': inparam.record
            }
        }).catch((err) => {
            console.error(err)
        })
    }
}

module.exports = HeraGameRecordModel
