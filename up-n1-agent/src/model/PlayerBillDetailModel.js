
const _ = require('lodash')
const config = require('config')
const BaseModel = require('./BaseModel')
class PlayerBillDetailModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.PlayerBillDetail,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    /**
     * 查询用户排行
     */
    async scanBillDetail() {
        const ret = await this.scan({
            ProjectionExpression: 'userName,#type,#amount',
            FilterExpression: '#type = :type1 OR #type = :type2',
            ExpressionAttributeNames: {
                '#type': 'type',
                '#amount': 'amount'
            },
            ExpressionAttributeValues: {
                ':type1': 3,
                ':type2': 4
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

module.exports = PlayerBillDetailModel
