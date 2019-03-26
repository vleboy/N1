const Tables = require('../lib/Model').Tables
const BaseModel = require('./BaseModel')

class PlayerBillDetailModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.PlayerBillDetail,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 根据时间范围获取流水
     * @param {*} inparam 
     */
    async queryByTime(inparam) {
        return await this.query({
            IndexName: 'UserNameIndex',
            KeyConditionExpression: 'userName=:userName and createdAt > :startTime',
            ProjectionExpression: 'amount,createdAt,balance,#type',
            ExpressionAttributeNames: {
                '#type': 'type',
            },
            ExpressionAttributeValues: {
                ':userName': inparam.userName,
                ':startTime': inparam.startTime,
            }
        })
    }
}

module.exports = PlayerBillDetailModel
