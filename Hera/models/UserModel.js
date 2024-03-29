const BaseModel = require('./BaseModel')
const { Tables } = require('../libs/Dynamo')
/**
 * 实际业务子类，继承于BaseModel基类
 */
module.exports = class UserModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.ZeusPlatformUser
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            role: 'NULL!',
            userId: 'NULL!'
        }
    }

    async queryUserById(userId) {
        const res = await this.query({
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ProjectionExpression: '#status,gameList,companyList,suffix,chip,isTest,sn',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':userId': userId }
        })
        return res.Items[0]
    }

    //通过displayId来查询
    async queryByDisplayId(displayId) {
        const res = await this.query({
            IndexName: 'merchantIdIndex',
            KeyConditionExpression: 'displayId = :displayId',
            ProjectionExpression: 'userId,apiKey,#status,suffix,loginWhiteList,username,#level,displayName,gameList,msn,sn,uname,#role,isTest,points',
            ExpressionAttributeNames: { '#status': 'status', '#level': 'level', '#role': 'role' },
            ExpressionAttributeValues: { ':displayId': +displayId }
        })
        return res.Items[0]
    }

    //通过role 和 plat查询
    async queryRolePlat(plat) {
        return this.queryOnce({
            ProjectionExpression: 'transferURL,apiKey,gameList,#status',
            KeyConditionExpression: '#role = :role',
            FilterExpression: 'sn = :sn',
            ExpressionAttributeNames: { '#role': 'role', '#status': 'status' },
            ExpressionAttributeValues: { ':role': '100', ':sn': plat }
        })
    }

    // 查询线路商下的所有商户
    queryAllChild(userId) {
        return this.query({
            ProjectionExpression: 'userId,displayId',
            KeyConditionExpression: '#role = :role',
            FilterExpression: 'contains(levelIndex,:levelIndex) ',
            ExpressionAttributeNames: { '#role': 'role' },
            ExpressionAttributeValues: { ':role': '100', ':levelIndex': userId }
        })
    }
}
