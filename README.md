# GLM-Translate

这是一个基于GLM模型的翻译插件，可以支持多种语言之间的翻译。

## 功能

* 支持多种语言之间的翻译
* 支持自定义翻译模型
* 选中文本后，鼠标悬停在选中文本上，会显示翻译结果
* 选中文本后，可右击选择翻译

![悬停效果](https://raw.githubusercontent.com/z184924/GLM-Translate/refs/heads/main/image/md-2.gif)
![右击效果](https://raw.githubusercontent.com/z184924/GLM-Translate/refs/heads/main/image/md-3.gif)

## 准备工作

所使用的GLM-4-Flash模型为免费模型。只需要准备GLM API Key即可。  
API key在[GLM官网](https://bigmodel.cn/)注册申请。

## 插件设置

文件 -> 首选项 -> 设置 -> 扩展 -> GLM-Translate -> apiKey，填入GLM API Key即可。

![配置页](https://raw.githubusercontent.com/z184924/GLM-Translate/refs/heads/main/image/md-1.png)

如本地有私有模型，则可以在设置中更换`baseUrl`路径。

1. `baseUrl`：请求模型路径
2. `apiKey`：GLM API Key
3. `modelName`：模型名称
4. `srcLanguage`: 源语言
5. `targetLanguage`：目标语言

## 项目仓库

[GLM-Translate](https://github.com/z184924/GLM-Translate)

**Enjoy!**
