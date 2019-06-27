const _ = require('lodash')
const BaseModel = require('./BaseModel')
const BizErr = require('../lib/Codes').BizErr
const Model = require('../lib/Model').Model
const config = require('config')
class UserModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.ZeusPlatformUser,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            role: Model.StringValue,
            userId: Model.StringValue
        }
    }

    /**
     * 通过userId查询用户
     * @param {*} userId 
     */
    async queryUserGameInfo(userId) {
        const querySet = await this.query({
            IndexName: 'UserIdIndex',
            ProjectionExpression: 'gameList',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        })
        if (querySet.Items.length - 1 != 0) {
            throw BizErr.UserNotFoundErr()
        }
        return querySet.Items[0]
    }

    /**
     * 根据角色和带前缀的用户名查询唯一用户
     * @param {*} role 
     * @param {*} username 
     */
    async getUserByName(role, username) {
        const queryRet = await this.query({
            IndexName: 'RoleUsernameIndex',
            KeyConditionExpression: '#role = :role and #username = :username',
            ExpressionAttributeNames: {
                '#username': 'username',
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':username': username,
                ':role': role
            }
        })
        const User = queryRet.Items[0]
        if (!User) {
            throw BizErr.UserNotFoundErr()
        }
        return User
    }
}

module.exports = UserModel