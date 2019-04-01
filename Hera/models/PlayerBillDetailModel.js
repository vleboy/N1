const BaseModel = require('./BaseModel')
const LogModel = require('./LogModel')
const moment = require('moment')
const _ = require('lodash')
const Tables = require('../libs/Dynamo')

/**
 * 实际业务子类，继承于BaseModel基类
 */
module.exports = class PlayerBillDetailModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.PlayerBillDetail
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            sn: 'NULL!'
        }
    }

    /**
     * 检查非下注流水是否超时
     * @param {*} inparam 
     */
    checkExpire(betItem, inparam) {
        const now = Date.now()
        if (now - betItem.createdAt > 170000) {
            new LogModel().add('3', 'flowerror', inparam, `接收流水时间【${moment(now).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}】对应BK【${inparam.businessKey}】的最早下注时间【${moment(bkBet.Items[0].createdAt).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}】, 延迟【${now - bkBet.Items[0].createdAt}毫秒】`, bkBet.Items[0].createdAt)
        }
    }

    /**
     * 获取单项账单流水
     * @param {*} userName 
     */
    getBill(sn) {
        return this.getItem({
            ConsistentRead: true,
            ProjectionExpression: 'parent,userId,userName,amount,balance,gameType,businessKey,createdAt',
            Key: { 'sn': sn }
        })
    }

    /**
     * 查询对应BK的下注
     * @param {*} inparam 
     */
    queryBkBet(inparam) {
        return this.queryOnce({
            IndexName: 'BusinessKeyIndex',
            ProjectionExpression: 'createdAt,#amount',
            KeyConditionExpression: 'businessKey = :businessKey',
            FilterExpression: '#type = :type',
            ExpressionAttributeNames: {
                '#type': 'type',
                '#amount': 'amount'
            },
            ExpressionAttributeValues: {
                ':businessKey': inparam.businessKey,
                ':type': 3
            }
        })
    }

    /**
     * 查询对应的BK数据
     * @param {*} inparam 
     */
    async queryBk(inparam) {
        const ret = await this.queryOnce({
            IndexName: 'BusinessKeyIndex',
            KeyConditionExpression: 'businessKey=:businessKey',
            ExpressionAttributeValues: {
                ':businessKey': inparam.bk
            }
        })
        return ret.Items
    }

    /**
     * 根据时间范围获取流水
     * @param {*} inparam 
     */
    async queryByTime(inparam) {
        return await this.query({
            IndexName: 'UserNameIndex',
            KeyConditionExpression: 'userName=:userName and createdAt > :startTime',
            ProjectionExpression: 'amount,createdAt,balance',
            ExpressionAttributeValues: {
                ':userName': inparam.userName,
                ':startTime': inparam.startTime,
            }
        })
    }
}
