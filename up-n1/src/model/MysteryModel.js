const _ = require('lodash')
const Model = require('../lib/Model').Model
const MysteryStatusEnum = require('../lib/Model').MysteryStatusEnum
const GlobalConfig = require("../util/config")
const BaseModel = require('./BaseModel')
class MysteryModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.SYSMystery,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            sn: Model.StringValue,
            winAt: Model.NumberValue
        }
    }

    /**
     * 添加神秘大奖记录
     * @param {*} inparam 
     */
    async add(inparam) {
        const ret = await this.putItem(inparam)
        return ret
    }

    /**
     * 查询神秘大奖列表
     * @param {*} inparam 
     */
    async page(inparam) {
        let query = {}
        // 条件搜索
        if (!_.isEmpty(inparam.query)) {
            if (inparam.query.winAt) {
                inparam.query.winAt = { $range: inparam.query.winAt }
            }
            if (inparam.query.userName) { inparam.query.userName = { $like: inparam.query.userName } }
            if (inparam.query.merchantName) { inparam.query.merchantName = { $like: inparam.query.merchantName } }
            if (inparam.query.msn) { inparam.query.msn = inparam.query.msn }
            if (inparam.query.nickname) { inparam.query.nickname = { $like: inparam.query.nickname } }
        }
        const adminRet = await this.bindFilterScan(query, inparam.query, false)
        // 排序输出
        let sortResult = _.sortBy(adminRet.Items, [inparam.sortkey || 'winAt'])
        if (inparam.sort == "desc") { sortResult = sortResult.reverse() }
        return sortResult
    }
    /**
     * 更新神秘大奖状态
     * @param {*} inparam 
     */
    async updateOperate(inparam) {
        let receiveAt = 0
        let operateName = Model.StringValue
        let operateNick = Model.StringValue

        if (inparam.status == MysteryStatusEnum.Received) {
            receiveAt = new Date().getTime()
            operateName = inparam.username
            operateNick = inparam.displayName
        }
        let updateObj = {
            Key: { 'sn': inparam.sn, 'winAt': parseInt(inparam.winAt) },
            UpdateExpression: 'SET #status = :status,receiveAt = :receiveAt,operateName=:operateName,operateNick=:operateNick',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': inparam.status,
                ':receiveAt': receiveAt,
                ':operateName': operateName,
                ':operateNick': operateNick
            }
        }
        const ret = await this.updateItem(updateObj)
        return { receiveAt: receiveAt }
    }

}

module.exports = MysteryModel