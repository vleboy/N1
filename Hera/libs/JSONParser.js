// JSONParser
const JSONParser = (data) => {
  const ret = (typeof data == 'object') ? data : JSON.parse(data)
  // 统一输入数据trim处理
  for (let i in ret) {
    if (typeof (ret[i]) == 'string') {
      ret[i] = ret[i].trim()
      if (ret[i] == 'NULL!' || ret[i] == '') {
        ret[i] = null
      }
    }
  }
  return ret
}

module.exports = JSONParser