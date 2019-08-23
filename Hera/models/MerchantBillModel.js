const BaseModel = require('./BaseModel')
const _ = require('lodash')
const moment = require('moment')
const uuid = require('uuid/v4')
const { Tables } = require('../libs/Dynamo')
/**
 * 实际业务子类，继承于BaseModel基类
 */
class MerchantBillModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.ZeusPlatformBill
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            sn: uuid(),
        }
    }
 
    /**
     * 查询用户余额
     * @param {*} user 
     */
    async checkUserBalance(user) {
        // 1、从缓存获取用户余额
        let initPoint = user.points
        let cacheRet = await this.query({
            TableName: Tables.SYSCacheBalance,
            KeyConditionExpression: 'userId = :userId AND #type = :type',
            ProjectionExpression: 'balance,lastTime',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':userId': user.userId,
                ':type': 'ALL'
            }
        })
        // 2、根据缓存是否存在进行不同处理，默认没有缓存查询所有
        let query = {
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ProjectionExpression: 'amount,createdAt',
            ExpressionAttributeValues: {
                ':userId': user.userId
            }
        }
        // 3、缓存存在，只查询后续流水
        if (cacheRet && !_.isEmpty(cacheRet.Items)) {
            // 获取缓存余额
            initPoint = cacheRet.Items[0].balance
            let lastTime = cacheRet.Items[0].lastTime
            // 根据最后缓存时间查询后续账单
            query = {
                IndexName: 'UserIdIndex',
                KeyConditionExpression: 'userId = :userId AND createdAt > :createdAt',
                ProjectionExpression: 'amount,createdAt',
                ExpressionAttributeValues: {
                    ':userId': user.userId,
                    ':createdAt': lastTime
                }
            }
        }
        let bills = await this.query(query)

        // 4、账单汇总
        const sums = _.reduce(bills.Items, (sum, bill) => {
            return sum + bill.amount
        }, 0.0)
        const balance = parseFloat((initPoint + sums).toFixed(2))
        // 5、更新用户余额缓存
        if (!_.isEmpty(bills.Items)) {
            new BaseModel().db$('put', {
                TableName: Tables.SYSCacheBalance,
                Item: { userId: user.userId, type: 'ALL', balance, lastTime: bills.Items[bills.Items.length - 1].createdAt }
            })
        }
        // 6、返回最后余额
        return balance
    }

    /**
     * 玩家转账
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
        batch.RequestItems[Tables.ZeusPlatformBill] = [{
            PutRequest: { Item: userBill }
        }]
        batch.RequestItems[Tables.PlayerBillDetail] = [{
            PutRequest: { Item: playerBill }
        }]
        return new BaseModel().batchWrite(batch)
    }
}

module.exports = MerchantBillModel