const { Tables, Model } = require('../lib/Dynamo')
const BaseModel = require('./BaseModel')

module.exports = class UserModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.ZeusPlatformUser,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            role: Model.StringValue,
            userId: Model.StringValue
        }
    }
    /**
    * 查询所有商户和代理
    * @param {*} userId 
    * @param {*} options 
    */
    async queryRoleLevel() {
        let query = {
            FilterExpression: "(#role = :role1 OR #role = :role2) AND levelIndex <> :levelIndex",
            ProjectionExpression: 'userId,#role',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':levelIndex': '0',
                ':role1': '100',
                ':role2': '1000'
            }
        }
        const [queryErr, querySet] = await this.scan(query)
        return querySet.Items
    }
}