# radish-tool-box

面向开发者的本地工具箱, 基于 Electron 打包为跨平台桌面应用. 把日常调试中零散的在线小工具 (JSON 格式化, 哈希计算, 编码转换, JWT 解析, 接口调试等) 收进一个离线的原生程序里.

除 "请求调试" 会按你的指令发起网络请求外, 其余工具全部在本地完成计算, 不上传任何数据.

## 工具一览

应用左侧导航切换六个工具:

| 工具     | 名称     | 用途                                          |
| -------- | -------- | --------------------------------------------- |
| 文档解析 | JSON     | 解析, 格式化, 树视图, 语义 diff, 路径提取     |
| 算法调试 | Crypto   | 哈希, HMAC, 口令派生, 对称/非对称加解密与签名 |
| 编码转换 | Encoding | 字节与文本在多种字符集之间互转, 自动探测      |
| 编码解码 | Codec    | Base 系列, URL, HTML 实体, 进制, 转义等编解码 |
| 令牌调试 | JWT      | JWT 解码, 签发, 验签, 声明校验                |
| 请求调试 | Request  | 多协议接口调试, 鉴权, 脚本, 集合运行          |

## 功能详情

### 文档解析 (JSON)

- 容错解析: 支持标准 JSON, JSONC (带注释), 并可对常见格式错误自动修复.
- 大数保真: 基于 lossless-json 保留超出 JS 安全整数范围的数字精度.
- 格式化与压缩: 可自定义缩进, 一键压缩, 递归排序对象键.
- 树视图: 结构化展开浏览, 配合虚拟滚动应对大文档.
- 语义 diff: 对两份文档做结构化差异比较, 忽略键序.
- 搜索: 支持正则与大小写敏感.
- 路径提取: 支持 JS 访问式, JSONPath, RFC 6901 Pointer 三种表示法.
- 字符转义与反转义.
- 一键清空: 清空当前文档内容, 并重置其选中, 展开与搜索状态.
- 编辑器基于 Monaco.

### 算法调试 (Crypto)

按算法大类分区:

- 哈希摘要 (16 种): MD4, MD5, SHA-1, SHA-224/256/384/512, SHA3-256/512, RIPEMD-160, BLAKE2b-256/512, BLAKE3, CRC32, Whirlpool, 国密 SM3.
- HMAC: 可选底层哈希 (SHA-256/384/512, SHA-1, SHA3-256/512, MD5, RIPEMD-160, SM3).
- 口令算法 (KDF): PBKDF2, HKDF, scrypt, bcrypt, Argon2i / Argon2d / Argon2id, 参数可配.
- 对称算法: AES (ECB/CBC/CFB/OFB/CTR/GCM), DES, 3DES, RC4, ChaCha20, ChaCha20-Poly1305, 国密 SM4; 支持 PKCS7, ISO10126, ANSIX923, Zero, None 填充, 以及 GCM/Poly1305 的 AAD.
- 非对称类: RSA (加解密与签名, OAEP/PKCS1v1.5 与 PSS/PKCS1v1.5), ECDSA, ECDH (secp256k1, P-256, P-384, P-521), Ed25519, X25519, 国密 SM2; 密钥支持 PEM 与 Hex.

哈希与 HMAC 由 hash-wasm 提供, 其余算法基于 @noble 系列与 sm-crypto-v2.

### 编码转换 (Encoding)

- 字节与文本双向转换, 覆盖 34 种字符集: Unicode (UTF-8, UTF-16 LE/BE, UTF-32 LE/BE), 中文 (GB2312, GBK, GB18030, Big5), 日文 (Shift_JIS, EUC-JP), 韩文 (EUC-KR), 西欧与通用 (ASCII, ISO-8859 系列, Windows-125x 系列), 斯拉夫及其它 (KOI8-R, KOI8-U, Mac Roman).
- 自动探测: 基于 jschardet 猜测输入编码.
- 十六进制展示可选紧凑, 空格分隔, 0x 数组等多种排版及大小写.

Unicode 家族手写实现, 旧字符集走 codepage 码表 (codepage 库).

### 编码解码 (Codec)

按族分组, 均为双向编解码:

- 二进制: Base64 (标准与 URL-safe), Base32, Base58, Base62, Base85 / Ascii85, Hex, 支持自定义码表.
- Web: URL 编码 (component / URI 两种范围), HTML 实体.
- 转义: Unicode 转义 (\uXXXX 与 \u{...}), JS 字符串转义.
- 数值: 2-36 任意进制转换, 支持 BigInt 与负数.
- 传输: Quoted-Printable, Punycode / IDN.
- 趣味: ROT13, 摩尔斯电码.

### 令牌调试 (JWT)

- 解码: 拆解 Header / Payload / Signature 三段, 不验签也能查看.
- 签发: 编辑头与载荷, 用指定密钥签名.
- 验签: 校验签名有效性, 密钥支持 PEM 与 JWK.
- 声明校验: 对 iss, sub, aud, iat, exp, nbf 等标准声明做时间与匹配检查.
- 签名算法: HS256/384/512, RS256/384/512, PS256/384/512, ES256/384/512, EdDSA.

基于 jose 实现.

### 请求调试 (Request)

多协议接口调试工作台, 面向 HTTP 及各类长连接协议.

协议:

- HTTP (含标准方法与自定义方法)
- WebSocket
- Socket.IO
- Server-Sent Events (SSE)
- 原始 TCP (可选 TLS)
- MQTT (订阅 / 发布, QoS 0/1/2)
- gRPC (支持 proto 加载与流式调用)

请求体: None, Raw (JSON/XML/Text/HTML/JS), x-www-form-urlencoded, multipart/form-data (含文件), 二进制, GraphQL.

鉴权: Basic, Bearer, API Key (Header / Query), Digest, OAuth2, AWS Signature V4.

导入与导出:

- 导入: cURL 命令, HAR, OpenAPI (Swagger 3), Postman 集合.
- 代码生成: 反向生成 cURL 命令.

自动化与组织:

- 前置 / 后置脚本, 支持变量注入, 响应提取与断言.
- 集合树管理, 批量运行集合, 支持 CSV / JSON 数据驱动迭代.
- 四级变量作用域 (全局 / 集合 / 环境 / 本地) 与 {{variable}} 替换.

连接与响应:

- Cookie Jar 自动管理 Set-Cookie, 按域与路径.
- 重定向跟随, 跨域时剥离敏感头.
- TLS 选项: 自定义 CA, 客户端证书 (mTLS), TLS 版本范围, SNI.
- 请求历史, 响应预览 (HTML / 图片 / 原始字节), 长连接消息流, 耗时与字节数指标.

网络请求在主进程执行, 经 IPC 与界面通信; test-servers/ 下附带联调用的本地服务.

## 应用特性

- 自定义标题栏与窗口控制 (最小化 / 最大化 / 关闭).
- 打开与保存文件, 维护最近文件列表, 支持拖拽打开.
- 各工具的输入与状态本地持久化, 重开自动恢复.

## 技术栈

- 运行时: Electron 42, Electron Forge (Vite 插件) 构建与打包.
- 界面: React 19, TypeScript, Tailwind CSS 4, Radix UI / shadcn/ui, lucide-react 图标, Monaco 编辑器.
- 状态: Zustand.
- 密码学: hash-wasm, @noble/hashes, @noble/ciphers, @noble/curves, node-forge, sm-crypto-v2, jose.
- 解析: jsonc-parser, jsonrepair, lossless-json, yaml, papaparse.
- 测试: Vitest, Testing Library, jsdom.

## 开发

要求 Node.js LTS 与 npm.

```bash
npm install       # 安装依赖
npm start         # 启动开发环境 (Electron Forge)
npm test          # 运行单元测试 (vitest run)
npm run test:watch
npm run lint      # ESLint 检查
npm run format    # Prettier 格式化
```

## 构建与打包

```bash
npm run package   # 生成未打包的应用目录
npm run make      # 生成分发安装包
```

打包目标由 forge.config.ts 配置:

- Windows: Squirrel 安装程序
- macOS: ZIP
- Linux: RPM 与 Deb

已通过 Electron Fuses 启用 asar 完整性校验, Cookie 加密, 并关闭 RunAsNode 等运行时开关.

## 目录结构

```
src/
  main.ts              主进程入口, 注册各 IPC 处理器
  preload.ts           预加载脚本
  file-io.ts           文件读写
  recent-files.ts      最近文件
  network/             请求调试的协议驱动与鉴权 (主进程侧)
    auth/              aws-v4, digest, oauth2, static-auth
    *-driver.ts        http, grpc, ws, sse, mqtt, socketio, tcp
  renderer/            界面 (React)
    components/        布局, 通用组件, ui (shadcn/ui)
    hooks/             各工具的持久化与执行 hook
    lib/               字符集, 字节编解码等共享逻辑
    tools/             六个工具, 各含 model / components / store
      registry.ts      工具注册表 (新增工具只改此处)
test-servers/          请求调试联调用的本地服务
```

每个工具按 model (纯逻辑), components (界面), store (状态) 分层, 逻辑与界面解耦, 便于独立测试; 源码附带大量 \*.test.ts 单元测试.

## 许可

MIT.
