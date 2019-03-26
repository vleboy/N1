const BizErr = require('../lib/Codes').BizErr
const Model = require('../lib/Model').Model
const GlobalConfig = require('../util/config')
const BaseModel = require('./BaseModel')
const PackageModel = require('./PackageModel')
const SeatModel = require('./SeatModel')
const _ = require('lodash')
class ToolModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.DianaPlatformTool,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            toolName: Model.StringValue,
            toolId: Model.StringValue
        }
    }

    /**
     * 添加道具
     * @param {*} inparam 
     */
    async addTool(inparam) {
        // 判断是否重复
        const exist = await this.isExist({
            KeyConditionExpression: 'toolName = :toolName',
            ExpressionAttributeValues: {
                ':toolName': inparam.toolName
            }
        })
        if (exist) {
            throw BizErr.ItemExistErr('道具已存在')
        }
        // 指定特殊几个道具id
        if (inparam.toolName == 'N币') {
            inparam.toolId = '100000'
        } else if (inparam.toolName == '房卡') {
            inparam.toolId = '200000'
        } else {//其他随机获取id
            let flag = true
            let scanRet = await this.scan({})
            let uucodeRet = await Model.getLengthNum(6)
            while (flag) {
                if (_.findIndex(scanRet.Items, function (o) { return o.toolId == uucodeRet }) == -1) {
                    flag = false
                } else {
                    uucodeRet = await Model.getLengthNum(6)
                }
            }
            inparam.toolId = uucodeRet
        }
        const dataItem = {
            ...this.item,
            ...inparam
        }
        // 保存
        const putRet = await this.putItem(dataItem)
        return dataItem
    }

    /**
     * 道具列表
     * @param {*} inparam
     */
    async list(inparam) {
        // 条件搜索
        let query = {}
        if (!_.isEmpty(inparam.query)) {
            if (inparam.query.toolId) { inparam.query.toolId = { $like: inparam.query.toolId } }
            if (inparam.query.toolName) { inparam.query.toolName = { $like: inparam.query.toolName } }
        }
        // 查询
        const ret = await this.bindFilterScan(query, inparam.query, false)
        const sortResult = _.sortBy(ret.Items, ['createdAt'])
        return sortResult
    }

    /**
     * 设置道具价格
     */
    async setPrice(inparam) {
        let updateObj = {
            Key: { 'toolName': inparam.toolName, 'toolId': inparam.toolId },
            UpdateExpression: 'SET toolPrice=:toolPrice ,comeUpRatio=:comeUpRatio,lowerRatio=:lowerRatio,#status=:status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':toolPrice': inparam.toolPrice,
                ':comeUpRatio': inparam.comeUpRatio,
                ':lowerRatio': inparam.lowerRatio,
                ':status': inparam.status
            }
        }
        const ret = await this.updateItem(updateObj)
        return ret
    }
    /**
     * 查询单个道具
     * @param {*} inparam
     */
    async getOne(inparam) {
        const ret = await this.query({
            KeyConditionExpression: 'toolName = :toolName and toolId = :toolId',
            ExpressionAttributeValues: {
                ':toolName': inparam.toolName,
                ':toolId': inparam.toolId
            }
        })
        if (ret.Items.length > 0) {
            return ret.Items[0]
        } else {
            return 0
        }
    }

    /**
     * 更新道具状态
     * @param {} inparam 
     */
    async changeStatus(inparam) {
        // 检查是否可以变更状态
        let ret = await new PackageModel().findIdsContains(inparam.toolId)
        if (ret) {
            throw BizErr.ItemUsed('道具在礼包中，不可变更')
        }
        ret = await new SeatModel().findIdsContains('tool_' + inparam.toolId)
        if (ret) {
            throw BizErr.ItemUsed('道具在展位中，不可变更')
        }
        // 变更状态
        ret = await this.updateItem({
            Key: {
                'toolName': inparam.toolName,
                'toolId': inparam.toolId
            },
            UpdateExpression: "SET toolStatus = :status",
            ExpressionAttributeValues: {
                ':status': inparam.status
            }
        })
        return ret
    }

    /**
     * 更新道具
     * @param {道具对象} inparam 
     */
    async updateTool(inparam) {
        // 检查是否可以更新
        // let [err, ret] = await new PackageModel().findIdsContains(inparam.toolId)
        // if (ret) {
        //     return [BizErr.ItemUsed('道具在礼包中，不可变更'), 0]
        // }
        // [err, ret] = await new SeatModel().findIdsContains('tool_' + inparam.toolId)
        // if (ret) {
        //     return [BizErr.ItemUsed('道具在展位中，不可变更'), 0]
        // }
        // 更新
        let ret = await this.getOne(inparam)
        if (!ret) {
            throw new BizErr.ItemNotExistErr()
        }
        ret.icon = inparam.icon
        ret.desc = inparam.desc
        ret.remark = inparam.remark
        // ret.toolStatus = inparam.toolStatus
        ret.updatedAt = Date.now()
        return await this.putItem(ret)
    }

    /**
     * 删除
     * @param {*} inparam
     */
    async delete(inparam) {
        // 检查是否可以删除
        let ret1 = await new PackageModel().findIdsContains(inparam.toolId)
        if (ret1) {
            throw BizErr.ItemUsed('道具在礼包中，不可删除')
        }
        let ret2 = await new SeatModel().findIdsContains('tool_' + inparam.toolId)
        if (ret2) {
            throw BizErr.ItemUsed('道具在展位中，不可删除')
        }
        // 删除
        let ret3 = await this.deleteItem({
            Key: {
                'toolName': inparam.toolName,
                'toolId': inparam.toolId
            }
        })

        // // End:删除生成的编码
        // this.db$('delete', { TableName: GlobalConfig.TABLE_NAMES.ZeusPlatformCode, Key: { type: 'tool', code: inparam.toolId } })

        return ret3
    }
}

module.exports = ToolModel

