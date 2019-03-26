
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const Model = require('../lib/Model').Model
const GlobalConfig = require("../util/config")
const BizErr = require('../lib/Codes').BizErr
const _ = require('lodash')
const BaseModel = require('./BaseModel')

class AdModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.HulkPlatformAd,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            adId: Model.StringValue
        }
    }

    /**
     * 添加
     * @param {*} inparam 
     */
    async addAd(inparam) {
        // 判断是否重复
        const exist = await this.isExist({
            IndexName: 'AdNameIndex',
            KeyConditionExpression: 'adName = :adName AND operatorName = :operatorName',
            ExpressionAttributeValues: {
                ':adName': inparam.adName,
                ':operatorName': inparam.operatorName
            }
        })
        if (exist) {
            throw BizErr.ItemExistErr('公告已存在')
        }
        // 获取新编号
        inparam.adId = Model.randomNum(6).toString()
        let checkExist = true
        while (checkExist) {
            let res = await this.getItem({
                ProjectionExpression: 'adId',
                Key: { 'adId': inparam.adId.toString() }
            })
            !res.Item || _.isEmpty(res.Item) ? checkExist = false : inparam.adId = Model.randomNum(6).toString()
        }
        const dataItem = { ...this.item, ...inparam }
        // 保存
        await this.putItem(dataItem)
        return dataItem
    }
    /**
    * 大厅获取公告列表
    * @param {*} inparam
    */
    async HallList(inparam) {
        //查询平台发的公告
        let query = {
            FilterExpression: 'operatorRole=:operatorRole AND adStatus=:adStatus AND publishTime<=:publishTime',
            ProjectionExpression: 'img,imgAli,#url,adName,#model,#text,#type,operatorRole,priority,createdAt',
            ExpressionAttributeNames: {
                '#url': 'url',
                '#model': 'model',
                '#text': 'text',
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':operatorRole': RoleCodeEnum.PlatformAdmin,
                ':adStatus': 1,
                ':publishTime': Date.now()
            }
        }
        // 如果需要查询商户公告
        if (inparam.operatorName) {
            query.FilterExpression = '(operatorRole=:operatorRole OR operatorName=:operatorName) AND adStatus=:adStatus AND publishTime<=:publishTime'
            query.ExpressionAttributeValues[':operatorName'] = inparam.operatorName
        }
        const ret = await this.scan(query)
        // 对公告进行排序
        let sortResult = _.orderBy(ret.Items, ['operatorRole', 'priority', 'createdAt'], ['desc', 'asc', 'asc'])
        // 对公告数据筛选
        for (let item of sortResult) {
            if (!item.imgAli) {
                delete item.imgAli
            }
            if (item.url == 'NULL!') {
                delete item.url
            }
            delete item.priority
            delete item.createdAt
        }
        return sortResult
    }

    /**
     * 列表
     * @param {*} inparam
     */
    async list(inparam) {
        // 查询
        let query = {
            FilterExpression: 'operatorRole=:operatorRole',
            ExpressionAttributeValues: {
                ':operatorRole': inparam.operatorRole || RoleCodeEnum.PlatformAdmin
            }
        }
        if (!Model.isPlatformAdmin(inparam.token)) {
            query = {
                FilterExpression: 'operatorName=:operatorName',
                ExpressionAttributeValues: {
                    ':operatorName': inparam.token.username
                }
            }
        }
        // 条件搜索
        if (!_.isEmpty(inparam.query)) {
            if (inparam.query.createdAt) {
                inparam.query.createdAt = { $range: inparam.query.createdAt }
            }
            if (inparam.query.msn) { inparam.query.msn = inparam.query.msn }
            if (inparam.query.displayName) { inparam.query.displayName = { $like: inparam.query.displayName } }
            if (inparam.query.operatorDisplayId) { inparam.query.operatorDisplayId = +inparam.query.operatorDisplayId }
            if (inparam.query.operatorSn) { inparam.query.operatorSn = inparam.query.operatorSn }
        }
        const ret = await this.bindFilterScan(query, inparam.query, false)
        const sortResult = _.sortBy(ret.Items, ['priority'])
        return sortResult
    }

    /**
     * 查询单个
     * @param {*} inparam
     */
    async getOne(inparam) {
        const ret = await this.query({
            KeyConditionExpression: 'adId = :adId',
            ExpressionAttributeValues: {
                ':adId': inparam.adId + ''
            }
        })
        if (ret.Items.length > 0) {
            return ret.Items[0]
        } else {
            return 0
        }
    }

    /**
     * 更新公告状态
     * @param {} inparam 
     */
    async changeStatus(inparam) {
        // 变更状态
        const ret = await this.updateItem({
            Key: {
                'adId': inparam.adId
            },
            UpdateExpression: "SET adStatus = :status",
            ExpressionAttributeValues: {
                ':status': inparam.status
            }
        })
        return ret
    }

    /**
     * 更新
     * @param {公告对象} inparam 
     */
    async updateAd(inparam) {
        // 更新
        const ret = await this.getOne(inparam)
        if (!ret) {
            throw new BizErr.ItemNotExistErr()
        }
        ret.img = inparam.img
        ret.url = inparam.url || Model.StringValue
        ret.remark = inparam.remark
        ret.adName = inparam.adName
        // ret.adStatus = inparam.adStatus
        ret.priority = inparam.priority
        ret.updatedAt = Date.now()
        ret.type = inparam.type
        ret.model = inparam.model
        ret.text = inparam.text
        ret.imgAli = inparam.imgAli || Model.StringValue
        ret.publishTime = inparam.publishTime
        return await this.putItem(ret)
    }

    /**
     * 删除
     * @param {*} inparam
     */
    async delete(inparam) {
        // 删除
        const ret = await this.deleteItem({
            Key: {
                'adId': inparam.adId
            }
        })
        return ret
    }
}

module.exports = AdModel
