const config = require('config')
const BaseModel = require('./BaseModel')

class MsnModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.ZeusPlatformUser,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 获取所有商户的线路号
     */
    async getAllMsn() {
        let query = {
            KeyConditionExpression: '#role = :role',
            ProjectionExpression: 'msn,displayName,#status',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':role': '100'
            }
        }
        return await this.query(query)
    }
}


module.exports = MsnModel