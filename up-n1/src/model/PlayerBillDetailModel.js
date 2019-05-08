const config = require('config')
const BaseModel = require('./BaseModel')
const _ = require('lodash')

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