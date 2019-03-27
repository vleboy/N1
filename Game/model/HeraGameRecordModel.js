
const Tables = require('../lib/Dynamo').Tables
const BaseModel = require('./BaseModel')
const _ = require('lodash')
const moment = require('moment')

/**
 * 战绩表实体
 */
module.exports = class HeraGameRecordModel extends BaseModel {
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
            batch.RequestItems[Tables.HeraGameRecord] = []
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
                    batch.RequestItems[Tables.HeraGameRecord].push({
                        PutRequest: {
                            Item: gameRecord
                        }
                    })
                }
            }
            // 数据存在时，写入数据库
            if (batch.RequestItems[Tables.HeraGameRecord].length > 0) {
                let p = this.batchWrite(batch)
                promiseArr.push(p)
            }
        }
        return promiseArr
    }
}
