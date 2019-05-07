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
    //获取用户的点数
    async queryUserBalance(userId) {
        const res = await this.query({
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ProjectionExpression: '#amount',
            ExpressionAttributeNames: {
                '#amount': 'amount'
            },
            ExpressionAttributeValues: {
                ':userId': userId
            }
        })
        let balance = 0
        if (res && res.Items.length != 0) {
            balance = _.sumBy(res.Items, function (o) { return o.amount })
            balance = parseFloat(balance.toFixed(2))
        }
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