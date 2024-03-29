// 系统配置参数
const _ = require('lodash')
const moment = require('moment')
const NP = require('number-precision')
const BaseModel = require('./BaseModel')
const config = require('config')
const PlayerBillDetailModel = require('./PlayerBillDetailModel')
const LogModel = require('./LogModel')
const GameStateEnum = require('../lib/Consts').GameStateEnum

/**
 * 实际业务子类，继承于BaseModel基类
 */
module.exports = class PlayerModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.TABLE_USER,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            userName: 'NULL!'
        }
    }

    /**
     * 根据主分区获取玩家
     * @param {*} userName 
     */
    async getPlayer(userName) {
        const res = await this.getItem({
            ConsistentRead: true,
            ProjectionExpression: 'userId,parent,userName,balance,gameId,sid,#state,gameState,gameList',
            ExpressionAttributeNames: {
                '#state': 'state'
            },
            Key: {
                'userName': userName
            }
        })
        if (!res || !res.Item || _.isEmpty(res.Item)) {
            console.error(`玩家${userName}不存在`)
            throw { code: -1, msg: `玩家${userName}不存在` }
        }
        if (res.Item.balance) {
            res.Item.balance = parseFloat(res.Item.balance.toFixed(2))
        }
        return res.Item
    }
    /**
   * 根据userId获取玩家游戏相关信息
   * @param {*} userId
   */
    async getPlayerById(userId) {
        const res = await this.query({
            ProjectionExpression: 'userName',
            IndexName: 'userIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': +userId
            },
            Limit: 1
        })
        if (res.Items.length < 1) {
            console.error(`玩家${userId}不存在`)
            throw { code: -1, msg: `玩家${userId}不存在` }
        }
        return await this.getPlayer(res.Items[0].userName)
    }

    /**
     * 根据userId校验玩家是否存在
     */
    async isUserIdExit(userId) {
        const res = await this.query({
            ProjectionExpression: 'userName',
            IndexName: 'userIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': +userId
            }
        })
        return (res && res.Items.length == 0) ? false : true
    }

    /**
     * 退出游戏
     * @param {*} userName
     */
    updateOffline(userName) {
        return this.updateItem({
            Key: { 'userName': userName },
            UpdateExpression: "SET gameState=:gameState,gameId=:gameId,sid=:sid",
            ExpressionAttributeValues: {
                ':gameState': GameStateEnum.OffLine,
                ':gameId': 0,
                ':sid': 0
            }
        })
    }
    //冻结或解冻玩家
    async updateState(userName, state) {
        return this.updateItem({
            Key: {
                'userName': userName
            },
            UpdateExpression: "SET #state=:state",
            ExpressionAttributeNames: {
                '#state': 'state'
            },
            ExpressionAttributeValues: {
                ':state': state
            }
        })
    }
    //获取指定父级id的玩家
    async queryPlayerByParent(parent) {
        let query = {
            IndexName: 'parentIdIndex',
            KeyConditionExpression: '#parent = :parent',
            ProjectionExpression: "userName, nickname, userId",
            ExpressionAttributeNames: {
                '#parent': 'parent'
            },
            ExpressionAttributeValues: {
                ':parent': parent
            }
        }
        let res = await this.query(query)
        return res.Items
    }
    //获取玩家列表
    getPlayerList(conditions, inparam) {
        let oldscan = {
            ...this.params,
            Limit: inparam.pageSize,
            ProjectionExpression: "userId,userName,buId,merchantName,nickname,#state,gameState,balance,joinTime,gameId,parent,createdAt,password",
            ExpressionAttributeNames: { "#state": "state" }
        }
        this.buildParms(oldscan, conditions)
        if (inparam.startKey) {
            oldscan.ExclusiveStartKey = inparam.startKey;
        }
        // if (oldscan.FilterExpression == '#msn <> :msn') {
        //     oldscan.FilterExpression += ' AND joinTime > :joinTime'
        //     oldscan.ExpressionAttributeValues[':joinTime'] = 0
        // }
        return this.forScanRes(oldscan, [], inparam.pageSize)
    }
    forScanRes(opts, array = [], pageSize = 20) {
        return this.db$('scan', opts).then((result) => {
            // 合并上一次的查询结果
            array = array.concat(result.Items)
            // 如果查询结果已经超过指定数量，则截取到指定数量返回
            if (array.length >= pageSize) {
                array = array.slice(0, pageSize)
                return array
            }
            // 没有查询到指定数量，且数据库还有剩余数据，则继续递归查询 
            else if (result.LastEvaluatedKey) {
                opts.ExclusiveStartKey = result.LastEvaluatedKey
                return this.forScanRes(opts, array, pageSize)
            }
            // 没有查询到指定数量，且数据库没有剩余数据，则全部返回 
            else {
                return array
            }
        }).catch((error) => {
            console.error(error)
        })
    }

    //查询指定时间内上线的玩家
    async scanOnline(inparam) {
        let res = { Items: [] }
        if (inparam.query.parent) {
            let parentRes = await this.query({
                TableName: config.env.TABLE_NAMES.ZeusPlatformUser,
                KeyConditionExpression: '#role = :role',
                FilterExpression: 'sn = :sn',
                ProjectionExpression: 'userId',
                ExpressionAttributeNames: {
                    '#role': 'role'
                },
                ExpressionAttributeValues: {
                    ':role': '100',
                    ':sn': inparam.query.parent
                }
            })
            if (!parentRes || !parentRes.Items || parentRes.Items.length < 0) {
                throw { code: -1, msg: '商户不存在' }
            }
            res = await this.query({
                IndexName: 'parentIdIndex',
                KeyConditionExpression: 'parent = :parent',
                FilterExpression: 'msn <> :msn AND joinTime >= :time0',
                ProjectionExpression: 'parent,userName,userId',
                ExpressionAttributeValues: {
                    ':parent': parentRes.Items[0].userId,
                    ':msn': '000',
                    ':time0': inparam.time0
                }
            })
        }
        else {
            res = await this.scan({
                FilterExpression: 'msn <> :msn AND joinTime >= :time0',
                ProjectionExpression: 'parent,userName,userId',
                ExpressionAttributeValues: {
                    ':msn': '000',
                    ':time0': inparam.time0
                }
            })
        }
        return res.Items
    }

    /**
    * 从缓存表获取最新玩家的余额
    * @param {*} userName
    * @param {*} userId
    * @param {*} balance 玩家表中的玩家余额
    */
    async getNewBalance(inparam) {
        //初始化缓存记录
        let isAllowUpdateCache = true
        let usage = inparam.usage
        let userName = inparam.userName
        let userId = inparam.userId
        let playerBalance = inparam.balance
        let cacheItem = { userId: userName, type: 'ALL', balance: 0, lastTime: -1 }
        let balance = 0
        //查询缓存记录，缓存存在，获取缓存余额和最后缓存时间
        let cacheRes = await this.getItem({ ConsistentRead: true, TableName: config.env.TABLE_NAMES.SYSCacheBalance, ProjectionExpression: 'balance,lastTime', Key: { 'userId': userName, 'type': 'ALL' } })
        if (cacheRes && !_.isEmpty(cacheRes.Item)) {
            cacheItem.balance = cacheRes.Item.balance
            cacheItem.lastTime = cacheRes.Item.lastTime
            balance = cacheItem.balance
        }
        //从玩家流水表获取从最后缓存时间开始的所有流水
        let billRes = await new PlayerBillDetailModel().queryByTime({ userName, startTime: cacheItem.lastTime })
        if (billRes && billRes.Items && billRes.Items.length > 0) {
            for (let item of billRes.Items) {
                balance = NP.plus(balance, item.amount)
            }
            // 如果最终余额和玩家表中的玩家余额不一致，则报警异常
            if (balance.toFixed(2) != playerBalance.toFixed(2)) {
                console.error(`玩家${userName}在玩家表余额和流水汇总余额不一致:玩家表余额${playerBalance},流水汇总余额${balance}`)
                new LogModel().add('2', `操作接口或类型为:${usage},玩家${userName}在玩家表余额和流水汇总余额不一致:玩家表余额${playerBalance},流水汇总余额${balance}`, { userName, userId, type: 'playerBalanceErr1' })
                isAllowUpdateCache = false
                // if (usage == 'billout') {
                //     return 'err'
                // }
            }
            // 最后一条的流水余额和玩家表余额不一致，则报警异常
            let lastBalance = billRes.Items[billRes.Items.length - 1].balance
            if (lastBalance.toFixed(2) != playerBalance.toFixed(2)) {
                console.error(`玩家${userName}在玩家表余额和流水最后余额不一致:玩家表余额${playerBalance},流水最后余额${lastBalance}`)
                new LogModel().add('2', `操作接口或类型为:${usage},玩家${userName}在玩家表余额和流水最后余额不一致:玩家表余额${playerBalance},流水最后余额${lastBalance}`, { userName, userId, type: 'playerBalanceErr2' })
                isAllowUpdateCache = false
                if (usage == 'billout') {
                    return 'err'
                }
            }
            //更新缓存
            if (isAllowUpdateCache) {
                cacheItem.balance = balance
                cacheItem.lastTime = billRes.Items[billRes.Items.length - 1].createdAt
                await new BaseModel().db$('put', { TableName: config.env.TABLE_NAMES.SYSCacheBalance, Item: cacheItem })
            }
        }
        return balance
    }

    //查询指定父级的玩家数量
    async count(parent) {
        let res = await this.query({
            IndexName: 'parentIdIndex',
            KeyConditionExpression: 'parent = :parent',
            ProjectionExpression: 'userId',
            ExpressionAttributeValues: {
                ':parent': parent
            }
        })
        return res.Count
    }

    /**
     * 更新玩家余额
     */
    async updatePlayerBalance(inparam) {
        let res = await this.updateItem({
            Key: { 'userName': inparam.userName },
            ReturnValues: ["UPDATED_OLD"],
            UpdateExpression: "SET balance = balance + :amt",
            ExpressionAttributeValues: { ':amt': inparam.amt }
        })
        let balance = parseFloat((res.Attributes.balance + inparam.amt).toFixed(2))
        return { originalAmount: res.Attributes.balance, amount: inparam.amt, balance }
    }

    /**
     * 商户自主给玩家上下分
     * @param {*} userBill
     * @param {*} playerBill 
     */
    async playerBillTransfer(userBill, playerBill) {
        userBill.createdAt = Date.now()
        userBill.updatedAt = Date.now()
        userBill.createdStr = moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        userBill.createdDate = moment().utcOffset(8).format('YYYY-MM-DD')
        userBill.createdTime = moment().utcOffset(8).format('HH:mm:ss')
        playerBill.createdAt = Date.now()
        playerBill.updatedAt = Date.now()
        playerBill.createdStr = moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        playerBill.createdDate = moment().utcOffset(8).format('YYYY-MM-DD')
        playerBill.createdTime = moment().utcOffset(8).format('HH:mm:ss')
        playerBill.businessKey = playerBill.sn
        let batch = { RequestItems: {} }
        batch.RequestItems[config.env.TABLE_NAMES.PLATFORM_BILL] = [{
            PutRequest: { Item: userBill }
        }]
        batch.RequestItems[config.env.TABLE_NAMES.PlayerBillDetail] = [{
            PutRequest: { Item: playerBill }
        }]
        return this.batchWrite(batch)
    }

    /**
     * 商户给玩家修改密码
     * @param {*} userName
     * @param {*} password 
     */     
    updatePassword(inparam) {
        return this.updateItem({
            Key: { 'userName': inparam.userName },
            UpdateExpression: "SET password=:password",
            ExpressionAttributeValues: { ':password': inparam.password }
        })
    }
}

