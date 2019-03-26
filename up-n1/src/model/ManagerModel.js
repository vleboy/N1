const _ = require('lodash')
const BaseModel = require('./BaseModel')
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const Model = require('../lib/Model').Model
const GlobalConfig = require("../util/config")
class ManagerModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.ZeusPlatformUser,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 线路商列表页
     * @param {*} token 
     * @param {*} inparam 
     */
    async page(token, inparam) {
        let query = {
            IndexName: 'RoleParentIndex',
            KeyConditionExpression: '#role = :role and parent = :parent',
            ProjectionExpression: 'userId,sn,displayName,msn,parent,parentName,parentDisplayName,parentRole,balance,gameList,createdAt,loginAt,#status,remark,suffix,uname,username,#role,points,isTest',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#status': 'status'
            }
        }
        if (inparam.isTest == 0) {              //只查正式线路商
            query.FilterExpression = 'isTest<>:isTest'
            query.ExpressionAttributeValues = {
                ':parent': token.userId,
                ':role': RoleCodeEnum.Manager,
                ':isTest': 1
            }
        } else if (inparam.isTest == 1) {       //只查测试线路商
            query.FilterExpression = 'isTest=:isTest'
            query.ExpressionAttributeValues = {
                ':parent': token.userId,
                ':role': RoleCodeEnum.Manager,
                ':isTest': inparam.isTest
            }
        } else {                                 //全查平台线路商
            query.ExpressionAttributeValues = {
                ':parent': token.userId,
                ':role': RoleCodeEnum.Manager
            }
        }
        if (Model.isPlatformAdmin(token)) {
            query = {
                KeyConditionExpression: '#role = :role',
                ProjectionExpression: 'userId,sn,displayName,msn,parent,parentName,parentDisplayName,parentRole,balance,gameList,createdAt,loginAt,#status,remark,suffix,uname,username,#role,points,isTest',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#status': 'status'
                }
            }
            if (inparam.isTest == 0) {              //只查正式线路商
                query.FilterExpression = 'isTest<>:isTest'
                query.ExpressionAttributeValues = {
                    ':role': RoleCodeEnum.Manager,
                    ':isTest': 1
                }
            } else if (inparam.isTest == 1) {       //只查测试线路商
                query.FilterExpression = 'isTest=:isTest'
                query.ExpressionAttributeValues = {
                    ':role': RoleCodeEnum.Manager,
                    ':isTest': inparam.isTest
                }
            } else {                                 //全查平台线路商
                query.ExpressionAttributeValues = {
                    ':role': RoleCodeEnum.Manager
                }
            }
        }

        // 条件搜索
        const queryRet = await this.bindFilterQuery(query, inparam.query, true)
        // 排序输出
        let sortResult = _.sortBy(queryRet.Items, [inparam.sortkey || 'level'])
        if (inparam.sort == "desc") { sortResult = sortResult.reverse() }
        return sortResult
    }
}

module.exports = ManagerModel