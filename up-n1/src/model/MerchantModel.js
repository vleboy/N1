const _ = require('lodash')
const BaseModel = require('./BaseModel')
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const Model = require('../lib/Model').Model
const GlobalConfig = require("../util/config")
class MerchantModel extends BaseModel {
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
            ProjectionExpression: 'userId,sn,displayId,displayName,msn,parent,parentName,parentDisplayName,parentRole,balance,gameList,createdAt,loginAt,#status,remark,uname,username,#role,points,isTest',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#status': 'status'
            }
        }
        if (inparam.isTest == 0) {              //只查正式商户的
            query.FilterExpression = 'isTest<>:isTest'
            query.ExpressionAttributeValues = {
                ':parent': token.userId,
                ':role': RoleCodeEnum.Merchant,
                ':isTest': 1
            }
        } else if (inparam.isTest == 1) {       //只查测试商户的
            query.FilterExpression = 'isTest=:isTest'
            query.ExpressionAttributeValues = {
                ':parent': token.userId,
                ':role': RoleCodeEnum.Merchant,
                ':isTest': inparam.isTest
            }
        } else {                                 //全查平台商户
            query.ExpressionAttributeValues = {
                ':parent': token.userId,
                ':role': RoleCodeEnum.Merchant
            }
        }
        if (Model.isPlatformAdmin(token)) {
            query = {
                KeyConditionExpression: '#role = :role',
                ProjectionExpression: 'userId,sn,displayId,displayName,msn,parent,parentName,parentDisplayName,parentRole,balance,gameList,createdAt,loginAt,#status,remark,uname,username,#role,points,isTest',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#status': 'status'
                }
            }
            if (inparam.isTest == 0) {              //只查正式商户的
                query.FilterExpression = 'isTest<>:isTest'
                query.ExpressionAttributeValues = {
                    ':role': RoleCodeEnum.Merchant,
                    ':isTest': 1
                }
            } else if (inparam.isTest == 1) {       //只查测试商户的
                query.FilterExpression = 'isTest=:isTest'
                query.ExpressionAttributeValues = {
                    ':role': RoleCodeEnum.Merchant,
                    ':isTest': inparam.isTest
                }
            } else {                                 //全查平台商户
                query.ExpressionAttributeValues = {
                    ':role': RoleCodeEnum.Merchant
                }
            }
        }
        // 条件搜索
        if (!_.isEmpty(inparam.query)) {
            if (inparam.query.msn) { inparam.query.msn = parseInt(inparam.query.msn).toString() }
            if (inparam.query.sn) { inparam.query.sn = { $like: inparam.query.sn } }
            if (inparam.query.displayName) { inparam.query.displayName = { $like: inparam.query.displayName } }
            if (inparam.query.displayId) { inparam.query.displayId = parseInt(inparam.query.displayId) }
        }
        const queryRet = await this.bindFilterQuery(query, inparam.query, false)
        // 排序输出
        let sortResult = _.sortBy(queryRet.Items, [inparam.sortkey || 'level'])
        if (inparam.sort == "desc") { sortResult = sortResult.reverse() }
        return sortResult
    }
}

module.exports = MerchantModel