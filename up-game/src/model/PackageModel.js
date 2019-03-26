const BizErr = require('../lib/Codes').BizErr
const Model = require('../lib/Model').Model
const GlobalConfig = require('../util/config')
const BaseModel = require('./BaseModel')
const SeatModel = require('./SeatModel')
const _ = require('lodash')
class PackageModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.TOOL_PACKAGE,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            packageName: Model.StringValue,
            packageId: Model.StringValue
        }
    }

    /**
     * 添加道具包
     * @param {*} inparam 
     */
    async add(inparam) {
        // 判断是否重复
        const exist = await this.isExist({
            KeyConditionExpression: 'packageName = :packageName',
            ExpressionAttributeValues: {
                ':packageName': inparam.packageName
            }
        })
        if (exist) {
            throw BizErr.ItemExistErr('道具包已存在')
        }
        let flag = true
        let scanRet = await this.scan({})
        let uucodeRet = await Model.getLengthNum(6)
        while (flag) {
            if (_.findIndex(scanRet.Items, function (o) { return o.packageId == uucodeRet }) == -1) {
                flag = false
            } else {
                uucodeRet = await Model.getLengthNum(6)
            }
        }
        inparam.packageId = uucodeRet
        // 获取所有添加的道具id，组合字符串以便查询
        let contentIds = ''
        for (let tool of inparam.content) {
            contentIds += (tool.toolId + ',')
        }
        inparam.contentIds = contentIds.substr(0, contentIds.length - 1)
        // 保存
        const dataItem = {
            ...this.item,
            ...inparam
        }
        const putRet = await this.putItem(dataItem)
        return dataItem
    }

    /**
     * 道具包列表
     * @param {*} inparam
     */
    async list(inparam) {
        // 查询
        const ret = await this.scan({
            // FilterExpression: ranges,
            // ExpressionAttributeValues: values
        })
        const sortResult = _.sortBy(ret.Items, ['createdAt'])
        return sortResult
    }

    /**
     * 查询单个道具包
     * @param {*} packageName
     * @param {*} packageId
     */
    async getOne(packageName, packageId) {
        const ret = await this.query({
            KeyConditionExpression: 'packageName = :packageName and packageId = :packageId',
            ExpressionAttributeValues: {
                ':packageName': packageName,
                ':packageId': packageId
            }
        })
        if (ret.Items.length > 0) {
            return ret.Items[0]
        } else {
            return 0
        }
    }

    /**
     * 更新道具包状态
     * @param {} inparam 
     */
    async changeStatus(inparam) {
        // 检查是否可以变更
        let ret = await new SeatModel().findIdsContains('package_' + inparam.packageId)
        if (ret) {
            throw BizErr.ItemUsed('礼包在展位中，不可变更')
        }
        // 变更
        ret = await this.updateItem({
            Key: {
                'packageName': inparam.packageName,
                'packageId': inparam.packageId
            },
            UpdateExpression: "SET packageStatus = :status",
            ExpressionAttributeValues: {
                ':status': inparam.status
            }
        })
        return ret
    }

    /**
     * 更新道具包
     * @param {道具包对象} inparam 
     */
    async update(inparam) {
        // 检查是否可以变更
        let ret2 = await new SeatModel().findIdsContains('package_' + inparam.packageId)
        if (ret2) {
            throw BizErr.ItemUsed('礼包在展位中，不可变更')
        }
        // 变更
        let ret = await this.getOne(inparam.packageName, inparam.packageId)
        if (!ret) {
            throw new BizErr.ItemNotExistErr()
        }
        ret.icon = inparam.icon
        ret.duration = inparam.duration
        ret.remark = inparam.remark
        ret.packageStatus = inparam.packageStatus
        ret.content = inparam.content
        ret.updatedAt = Date.now()

        // 获取所有添加的道具id，组合字符串以便查询
        let contentIds = ''
        for (let tool of inparam.content) {
            contentIds += (tool.toolId + ',')
        }
        ret.contentIds = contentIds.substr(0, contentIds.length - 1)

        return await this.putItem(ret)
    }

    /**
     * 删除道具包
     * @param {*} inparam
     */
    async delete(inparam) {
        // 检查是否可以删除
        let ret2 = await new SeatModel().findIdsContains('package_' + inparam.packageId)
        if (ret2) {
            throw BizErr.ItemUsed('礼包在展位中，不可删除')
        }
        // 删除
        let ret = await this.deleteItem({
            Key: {
                'packageName': inparam.packageName,
                'packageId': inparam.packageId
            }
        })

        // // End:删除生成的编码
        // this.db$('delete', { TableName: GlobalConfig.TABLE_NAMES.ZeusPlatformCode, Key: { type: 'package', code: inparam.packageId } })

        return ret
    }
}

module.exports = PackageModel

