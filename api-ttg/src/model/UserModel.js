const BaseModel = require('./BaseModel')

/**
 * 实际业务子类，继承于BaseModel基类
 */
module.exports = class UserModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: 'ZeusPlatformUser'
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            role: 'NULL!',
            userId: 'NULL!'
        }
    }

    queryUserById(userId) {
        return this.queryOnce({
            ProjectionExpression: '#status,gameList,companyList',
            ExpressionAttributeNames: { '#status': 'status' },
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: { ':userId': userId }
        })
    }
}
