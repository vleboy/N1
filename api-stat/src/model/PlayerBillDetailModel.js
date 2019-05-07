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
    queryByTime(inparam) {
        return this.query({
            IndexName: 'UserNameIndex',
            KeyConditionExpression: 'userName=:userName and createdAt > :createdAt',
            ProjectionExpression: 'amount,balance,createdAt',
            ExpressionAttributeValues: {
                ':userName': inparam.userName,
                ':createdAt': inparam.createdAt
            }
        })
    }
}

module.exports = PlayerBillDetailModel
