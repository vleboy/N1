
const BizErr = require('../lib/Codes').BizErr
const config = require('config')
const BaseModel = require('./BaseModel')
class SubRoleModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.SYSRolePermission,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            plat: 'AGENT'
        }
    }

    /**
     * 添加子角色
     * @param {*} inparam 
     */
    async addSubRole(inparam) {
        // 判断是否重复
        const exist = await this.isExist({
            KeyConditionExpression: '#name = :name AND plat=:plat',
            ExpressionAttributeNames: {
                '#name': 'name'
            },
            ExpressionAttributeValues: {
                ':name': inparam.name,
                ':plat': 'AGENT'
            }
        })
        if (exist) {
            throw BizErr.ItemExistErr('已存在相同角色')
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
     * 子角色列表
     * @param {*} inparam
     */
    async listSubRole(inparam) {
        const ret = await this.scan({
            FilterExpression: 'plat=:plat',
            ExpressionAttributeValues: {
                ':plat': 'AGENT'
            }
        })
        return ret
    }

    /**
     * 查询单条
     * @param {*} inparam
     */
    async getOne(inparam) {
        const ret = await this.query({
            KeyConditionExpression: '#name = :name AND plat=:plat',
            ExpressionAttributeNames: {
                '#name': 'name',
            },
            ExpressionAttributeValues: {
                ':name': inparam.name,
                ':plat': 'AGENT'
            }
        })
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
        const ret = await this.updateItem({
            Key: { name: inparam.name, plat: 'AGENT' },
            UpdateExpression: 'SET #permissions = :permissions,remark=:remark,updatedAt=:updatedAt',
            ExpressionAttributeNames: {
                '#permissions': 'permissions',
            },
            ExpressionAttributeValues: {
                ':permissions': inparam.permissions,
                ':updatedAt': Date.now(),
                ':remark': inparam.remark
            }
        })
        return ret
    }

    /**
     * 删除
     * @param {*} inparam
     */
    async delete(inparam) {
        const ret = await this.deleteItem({
            Key: {
                'name': inparam.name,
                'plat': 'AGENT'
            }
        })
        return ret
    }
}


module.exports = SubRoleModel

