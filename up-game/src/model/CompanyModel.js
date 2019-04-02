const BizErr = require('../lib/Codes').BizErr
const Model = require('../lib/Model').Model
const config = require('config')
const BaseModel = require('./BaseModel')
const uuid = require('uuid/v4')
class CompanyModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.DianaPlatformCompany,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            companyName: Model.StringValue,
            companyId: uuid(),
            companyKey: uuid()
        }
    }

    /**
     * 添加厂商
     * @param {*} companyInfo 
     */
    async addCompany(companyInfo) {
        // 判断是否重复
        const exist = await this.isExist({
            KeyConditionExpression: 'companyName = :companyName',
            ExpressionAttributeValues: {
                ':companyName': companyInfo.companyName
            }
        })
        if (exist) {
            throw BizErr.ItemExistErr('运营商已存在')
        }
        //判断运营商标识是否重复
        const ret = await this.scan({
            FilterExpression: 'companyIden = :companyIden',
            ExpressionAttributeValues: {
                ':companyIden': companyInfo.companyIden
            }
        })
        if (ret.Items.length != 0) {
            throw BizErr.ItemExistErr('运营商标识已存在')
        }
        const dataItem = {
            ...this.item,
            ...companyInfo
        }
        // 保存
        const putRet = await this.putItem(dataItem)

        return dataItem
    }

    /**
     * 厂商列表
     * @param {*} inparams
     */
    async listCompany(inparams) {
        const ret = await this.scan({
        })
        return ret
    }

    /**
     * 更新厂商状态
     * @param {厂商名称} companyName 
     * @param {厂商ID} companyId 
     * @param {需要变更的状态} status 
     */
    async changeStatus(companyName, companyId, status) {
        const ret = await this.updateItem({
            Key: {
                'companyName': companyName,
                'companyId': companyId
            },
            UpdateExpression: "SET companyStatus = :status",
            ExpressionAttributeValues: {
                ':status': status
            }
        })
        return ret
    }

    /**
     * 查询单个厂商
     * @param {*} inparam
     */
    async getOne(inparam) {
        let query = {
            ProjectionExpression: 'companyKey',
            KeyConditionExpression: 'companyName = :companyName',
            ExpressionAttributeValues: {
                ':companyName': inparam.companyName
            }
        }
        if (inparam.companyId) {
            delete query.ProjectionExpression
            query.KeyConditionExpression += ' AND companyId = :companyId'
            query.ExpressionAttributeValues[':companyId'] = inparam.companyId
        }
        const ret = await this.query(query)
        if (ret.Items.length > 0) {
            return ret.Items[0]
        } else {
            return 0
        }
    }

    /**
     * 更新
     * @param {*} inparam 
     */
    async update(inparam) {
        // 更新
        const ret = await this.getOne(inparam)
        if (!ret) {
            throw new BizErr.ItemNotExistErr()
        }
        ret.companyContact = inparam.companyContact
        ret.companyContactWay = inparam.companyContactWay
        ret.companyContract = inparam.companyContract
        ret.companyDesc = inparam.companyDesc
        ret.companyEmail = inparam.companyEmail
        ret.companyRegion = inparam.companyRegion
        ret.license = inparam.license
        ret.updatedAt = Date.now()
        ret.companyRatio = inparam.companyRatio
        ret.gameTypeList = inparam.gameTypeList
        await this.putItem(ret)
        return ret
    }
}

module.exports = CompanyModel


