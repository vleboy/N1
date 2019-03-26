const BizErr = require('../lib/Codes').BizErr
const Model = require('../lib/Model').Model
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const GlobalConfig = require('../util/config')
const BaseModel = require('./BaseModel')
const _ = require('lodash')
const uuid = require('uuid/v4')
class SeatModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.TOOL_SEAT,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            seatId: uuid()
        }
    }

    /**
     * 添加席位
     * @param {*} inparam 
     */
    async add(inparam) {
        let query = {
            IndexName: 'SeatTypeIndex',
            KeyConditionExpression: 'seatType = :seatType AND #order = :order',
            ExpressionAttributeNames: {
                '#order': 'order'
            },
            ExpressionAttributeValues: {
                ':seatType': inparam.seatType,
                ':order': inparam.order
            }
        }
        if (!Model.isPlatformAdmin(inparam.token)) {
            query.FilterExpression = 'operatorName = :operatorName'
            query.ExpressionAttributeValues[':operatorName'] = inparam.token.username
        } else {
            query.FilterExpression = 'operatorRole = :operatorRole'
            query.ExpressionAttributeValues[':operatorRole'] = inparam.token.role
        }
        // 判断编号是否重复
        const exist = await this.isExist(query)
        if (exist) { throw BizErr.ItemExistErr('编号已存在') }
        // 获取所有添加的道具/礼包id，组合字符串以便查询
        let contentIds = ''
        if (inparam.content['toolId']) {
            contentIds += ('tool_' + inparam.content['toolId'] + ',')
        } else {
            contentIds += ('package_' + inparam.content['packageId'] + ',')
        }
        inparam.contentIds = contentIds.substr(0, contentIds.length - 1)
        // 保存
        delete inparam.token
        const dataItem = {
            ...this.item,
            ...inparam
        }
        const putRet = await this.putItem(dataItem)
        return dataItem
    }

    /**
     * 席位列表
     * @param {*} inparam
     */
    async list(inparam) {
        let query = {
            IndexName: 'SeatTypeIndex',
            FilterExpression: 'seatType = :seatType AND operatorRole=:operatorRole',
            ExpressionAttributeValues: {
                ':seatType': inparam.seatType,
                ':operatorRole': inparam.operatorRole || RoleCodeEnum.PlatformAdmin
            }
        }
        if (!Model.isPlatformAdmin(inparam.token)) {
            query = {
                IndexName: 'SeatTypeIndex',
                FilterExpression: 'seatType = :seatType AND operatorName=:operatorName',
                ExpressionAttributeValues: {
                    ':seatType': inparam.seatType,
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
        }
        // 查询
        const ret = await this.bindFilterScan(query, inparam.query, false)
        const retOrderBy = _.sortBy(ret.Items, ['order'])
        return retOrderBy
    }

    /**
    * 查看所有商户席位列表
    * @param {*} inparam
    */
    async listAll(inparam) {
        let query = {
            IndexName: 'SeatTypeIndex',
            FilterExpression: 'seatType = :seatType AND operatorRole=:operatorRole',
            ExpressionAttributeValues: {
                ':seatType': inparam.seatType,
                ':operatorRole': inparam.operatorRole || RoleCodeEnum.PlatformAdmin
            }
        }
        if (!Model.isPlatformAdmin(inparam.token)) {
            query = {
                IndexName: 'SeatTypeIndex',
                FilterExpression: 'seatType = :seatType AND operatorName=:operatorName',
                ExpressionAttributeValues: {
                    ':seatType': inparam.seatType,
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
        // 查询
        const ret = await this.bindFilterScan(query, inparam.query, false)
        let objectInfo = _.groupBy(ret.Items, 'operatorDisplayName')

        let arrInfo = []
        for (let key in objectInfo) {
            arrInfo.push(objectInfo[key])
        }
        return arrInfo
    }
    /**
     * 查询单个席位
     * @param {*} inparam
     */
    async getOne(inparam) {
        const ret = await this.query({
            KeyConditionExpression: 'seatId = :seatId',
            ExpressionAttributeValues: {
                ':seatId': inparam.seatId
            }
        })
        if (ret.Items.length > 0) {
            return ret.Items[0]
        } else {
            return 0
        }
    }

    /**
     * 更新席位状态
     * @param {入参} inparam 
     */
    async changeStatus(inparam) {
        const ret = await this.updateItem({
            Key: {
                'seatId': inparam.seatId
            },
            UpdateExpression: "SET seatStatus = :status",
            ExpressionAttributeValues: {
                ':status': inparam.status
            }
        })
        return ret
    }

    /**
     * 更新席位
     * @param {席位对象} inparam 
     */
    async update(inparam) {
        let query = {
            IndexName: 'SeatTypeIndex',
            KeyConditionExpression: 'seatType = :seatType AND #order = :order',
            ExpressionAttributeNames: {
                '#order': 'order'
            },
            ExpressionAttributeValues: {
                ':seatType': inparam.seatType,
                ':order': inparam.order
            }
        }
        if (!Model.isPlatformAdmin(inparam.token)) {
            query.FilterExpression = 'operatorName = :operatorName'
            query.ExpressionAttributeValues[':operatorName'] = inparam.token.username
        } else {
            query.FilterExpression = 'operatorRole = :operatorRole'
            query.ExpressionAttributeValues[':operatorRole'] = inparam.token.role
        }
        query.FilterExpression += ' AND seatId <> :seatId'
        query.ExpressionAttributeValues[':seatId'] = inparam.seatId
        // 判断编号是否重复
        const exist = await this.isExist(query)
        if (exist) { throw BizErr.ItemExistErr('编号已存在') }
        // 更新
        const ret = await this.getOne(inparam)
        if (!ret) { throw new BizErr.ItemNotExistErr() }
        ret.order = inparam.order
        ret.price = inparam.price
        ret.remark = inparam.remark
        ret.seatStatus = inparam.seatStatus
        ret.seatType = inparam.seatType
        ret.sum = inparam.sum
        ret.content = inparam.content
        ret.icon = inparam.icon
        ret.updatedAt = Date.now()
        // 获取所有添加的道具/礼包id，组合字符串以便查询
        let contentIds = ''
        if (inparam.content['toolId']) {
            contentIds += ('tool_' + inparam.content['toolId'] + ',')
        } else {
            contentIds += ('package_' + inparam.content['packageId'] + ',')
        }
        ret.contentIds = contentIds.substr(0, contentIds.length - 1)
        return await this.putItem(ret)
    }

    /**
     * 删除席位
     * @param {*} inparam
     */
    async delete(inparam) {
        const ret = await this.deleteItem({
            Key: {
                'seatId': inparam.seatId
            }
        })
        return ret
    }
    /**
     * 展位互换
     * @param {*} inparam
     */
    async seatTigger(inparam) {
        let updatTime = new Date().getTime()
        let updateObj1 = {
            Key: { 'seatId': inparam.beforeSeatId },
            UpdateExpression: 'SET #order=:order ,updatedAt=:updatedAt',
            ExpressionAttributeNames: {
                '#order': 'order'
            },
            ExpressionAttributeValues: {
                ':order': inparam.afterOrder,
                ':updatedAt': updatTime
            }
        }
        this.updateItem(updateObj1).then((res) => {
            console.log(res)
        }).catch((err) => {
            console.error(err)
        })
        let updateObj2 = {
            Key: { 'seatId': inparam.afterSeatId },
            UpdateExpression: 'SET #order=:order,updatedAt=:updatedAt',
            ExpressionAttributeNames: {
                '#order': 'order'
            },
            ExpressionAttributeValues: {
                ':order': inparam.beforeOrder,
                ':updatedAt': updatTime
            }
        }
        this.updateItem(updateObj2).then((res) => {
            console.log(res)
        }).catch((err) => {
            console.error(err)
        })
        return []
    }
}

module.exports = SeatModel
