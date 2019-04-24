
const { Tables, RoleCodeEnum } = require('../lib/Dynamo')
const BaseModel = require('./BaseModel')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
const moment = require('moment')
const axios = require('axios')

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
     * 批量写入第三方游戏记录
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
                    if (parseInt(item.gameType) == 1070000 && item.anotherGameData != 'NULL!') {
                        gameRecord.betTime = item.betTime
                        gameRecord.createdAt = item.createdAt
                        gameRecord.createdStr = item.createdStr
                        delete gameRecord.createdDate
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

    /**
     * 查询KY战绩
     * @param {*} beginTime 
     * @param {*} endTime 
     */
    async getKYRecord(beginTime, endTime) {
        let tokenAdmin = jwt.sign({
            role: RoleCodeEnum.PlatformAdmin,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) * 3,
            iat: Math.floor(Date.now() / 1000) - 30
        }, process.env.TOKEN_SECRET)
        try {
            let res = await axios.get(`https://${process.env.ANOTHER_GAME_CENTER}/ky/betdetail?startTime=${beginTime}&endTime=${endTime}`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } })
            let listArr = []
            if (res.data.code == 0) {
                let listMap = res.data.list
                //玩家分组查询对应的商户id
                let groupByMap = _.groupBy(listMap.Accounts)
                let parentIdArr = []
                for (let kyUserId in groupByMap) {
                    let playerRes = await new BaseModel().query({
                        TableName: 'HeraGamePlayer',
                        IndexName: 'userIdIndex',
                        KeyConditionExpression: 'userId = :userId',
                        ProjectionExpression: 'parent,userId,userName',
                        ExpressionAttributeValues: {
                            ':userId': +kyUserId.split('_')[1]
                        }
                    })
                    parentIdArr.push({ kyUserId, parent: playerRes.Items[0].parent, userId: playerRes.Items[0].userId, userName: playerRes.Items[0].userName })
                }
                for (let i = 0; i < res.data.count; i++) {
                    let anotherGameData = {
                        GameID: listMap.GameID[i],
                        Accounts: listMap.Accounts[i],
                        ServerID: listMap.ServerID[i],
                        KindID: listMap.KindID[i],
                        TableID: listMap.TableID[i],
                        ChairID: listMap.ChairID[i],
                        UserCount: listMap.UserCount[i],
                        CellScore: listMap.CellScore[i],
                        AllBet: listMap.AllBet[i],
                        Profit: listMap.Profit[i],
                        Revenue: listMap.Revenue[i],
                        GameStartTime: listMap.GameStartTime[i],
                        GameEndTime: listMap.GameEndTime[i],
                        CardValue: listMap.CardValue[i]
                    }
                    let gameRecord = {
                        betTime: new Date(anotherGameData.GameStartTime).getTime(),
                        createdAt: new Date(anotherGameData.GameEndTime).getTime(),
                        createdStr: anotherGameData.GameEndTime,
                        gameId: '1070001',
                        gameType: 1070000,
                        anotherGameData
                    }
                    let item = _.find(parentIdArr, (o) => { return o.kyUserId == anotherGameData.Accounts })
                    gameRecord.parent = item.parent
                    gameRecord.userId = item.userId
                    gameRecord.userName = item.userName
                    gameRecord.businessKey = `BKY_${item.userName}_${listMap.GameID[i]}`
                    listArr.push(gameRecord)
                }
            } else if (res.data.code != 16) {
                console.error('记录查询失败日志')
            }
            return listArr
        } catch (error) {
            console.error(error)
        }
    }

}

