const _ = require('lodash')
const NP = require('number-precision')
const Tables = require('../lib/Model').Tables
const Model = require('../lib/Model').Model
const BaseModel = require('./BaseModel')
const PlayerBillDetailModel = require('./PlayerBillDetailModel')

class PlayerModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.HeraGamePlayer,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            userName: Model.StringValue
        }
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
        let cacheRes = await this.getItem({ ConsistentRead: true, TableName: 'SYSCacheBalance', ProjectionExpression: 'balance,lastTime', Key: { 'userId': userName, 'type': 'ALL' } })
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
                // new LogModel().add('2', 'playerBalanceErr1', { userName, userId }, `操作接口或类型为:${usage},玩家${userName}在玩家表余额和流水汇总余额不一致:玩家表余额${playerBalance},流水汇总余额${balance}`)
                isAllowUpdateCache = false
                if (usage == 'billout') {
                    return 'err'
                }
            }
            // 最后一条的流水余额和玩家表余额不一致，则报警异常
            let lastBalance = billRes.Items[billRes.Items.length - 1].balance
            try {
                if (lastBalance.toFixed(2) != playerBalance.toFixed(2)) {
                    console.error(`玩家${userName}在玩家表余额和流水最后余额不一致:玩家表余额${playerBalance},流水最后余额${lastBalance}`)
                    // new LogModel().add('2', 'playerBalanceErr2', { userName, userId }, `操作接口或类型为:${usage},玩家${userName}在玩家表余额和流水最后余额不一致:玩家表余额${playerBalance},流水最后余额${lastBalance}`)
                    isAllowUpdateCache = false
                    if (usage == 'billout') {
                        return 'err'
                    }
                }
            }
            catch (error) {
                console.error(userName)
            }
            //更新缓存
            if (isAllowUpdateCache) {
                cacheItem.balance = balance
                cacheItem.lastTime = billRes.Items[billRes.Items.length - 1].createdAt
                await new BaseModel().db$('put', { TableName: 'SYSCacheBalance', Item: cacheItem })
            }
        }
        return balance
    }
}

module.exports = PlayerModel
