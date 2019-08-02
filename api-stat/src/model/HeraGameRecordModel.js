const { Tables, RoleCodeEnum } = require('../lib/Model')
const BaseModel = require('./BaseModel')
const _ = require('lodash')
const moment = require('moment')
const LogModel = require('./LogModel')
const config = require('config')
const jwt = require('jsonwebtoken')
const axios = require('axios')

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
                            anotherGameData: item.anotherGameData
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

    /**
     * 获取指定玩家一段时间的战绩
     */
    async getPlayerRecord(inparam) {
        let res = await this.query({
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
        return res.Items
    }

    /**
     * 获取时间段的战绩表数据
     */
    async getTimeRecord(userId, inparam) {
        let res = await this.query({
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
    /**
     * 查询KY战绩
     * @param {*} beginTime 
     * @param {*} endTime 
     */
    async getKYRecord(beginTime, endTime) {
        let tokenAdmin = jwt.sign({
            role: RoleCodeEnum.PlatformAdmin,
            exp: Math.floor(Date.now() / 1000) + 86400
        }, config.na.TOKEN_SECRET)
        try {
            // 向KY查询
            let res = await axios.get(`http://${config.na.ANOTHER_GAME_CENTER}/ky/betdetail?startTime=${beginTime}&endTime=${endTime}`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } })
            let listArr = []
            if (res.data.code == 0) {
                let listMap = res.data.list
                //玩家分组查询对应的商户id
                let groupByMap = _.groupBy(listMap.Accounts)
                let parentIdArr = []
                for (let kyUserId in groupByMap) {
                    let playerRes = await this.query({
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
                        betTime: new Date(`${anotherGameData.GameStartTime}+08:00`).getTime(),
                        createdAt: new Date(`${anotherGameData.GameEndTime}+08:00`).getTime(),
                        gameId: '1070001',
                        gameType: 1070000,
                        anotherGameData
                    }
                    let item = _.find(parentIdArr, (o) => { return o.kyUserId == anotherGameData.Accounts })
                    gameRecord.parent = item.parent
                    gameRecord.userId = item.userId
                    gameRecord.userName = item.userName
                    gameRecord.businessKey = `BKY_${item.userId}_${listMap.GameID[i]}`
                    listArr.push(gameRecord)
                }
                // 写入KY游戏记录
                await Promise.all(this.batchWriteRound(listArr))
            }
            return true
        } catch (error) {
            new LogModel().add('2', 'KYRecordError', { startTime: beginTime, endTime }, `KY获取游戏注单请求异常&startTime=${beginTime}&endTime=${endTime}`)
            console.error(error)
            return false
        }
    }

    /**
     * 查询VG战绩
     * @param {*} id
     */
    async getVGRecord(id = 0) {
        let res = await axios.get(`http://${config.na.ANOTHER_GAME_CENTER}/vg/betdetail/${id}`)
        let resArr = res.data
        let recordArr = []
        if (resArr && resArr.length > 0) {
            //玩家分组查询对应的商户id
            let groupByMap = _.groupBy(resArr, 'username')
            console.log(groupByMap)
            let parentIdArr = []
            for (let userId in groupByMap) {
                let playerRes = await this.query({
                    IndexName: 'userIdIndex',
                    KeyConditionExpression: 'userId = :userId',
                    ProjectionExpression: 'parent,userId,userName',
                    ExpressionAttributeValues: { ':userId': +userId }
                })
                parentIdArr.push({ parent: playerRes.Items[0].parent, userId: playerRes.Items[0].userId, userName: playerRes.Items[0].userName })
            }
            for (let record of resArr) {
                let anotherGameData = { ...record }
                let gameRecord = {
                    betTime: new Date(`${record.begintime}+08:00`).getTime(),
                    createdAt: new Date(`${record.createtime}+08:00`).getTime(),
                    gameId: '1100001',
                    gameType: 1100000,
                    anotherGameData
                }
                let item = _.find(parentIdArr, (o) => { return o.userId == +record.username })
                gameRecord.parent = item.parent
                gameRecord.userId = item.userId
                gameRecord.userName = item.userName
                gameRecord.businessKey = `BVG_${item.userId}_${item.id}`
                recordArr.push(gameRecord)
            }
            // 写入VG游戏记录
            await Promise.all(this.batchWriteRound(recordArr))
            // 返回最后一条id
            return resArr[resArr.length - 1].id
        }
        return id
    }
}

module.exports = HeraGameRecordModel
