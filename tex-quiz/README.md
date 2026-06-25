# TeX 单选测验

一个可以放到 GitHub Pages 的静态答题页，支持 TeX/LaTeX 公式、微信扫码答题、自动判分、导出成绩。

## 怎么批改

题库优先从 `questions.csv` 读取。每一行题目都有 `答案` 和 `分值`：

```csv
编号,题干,A,B,C,D,答案,分值,启用
q1,"设 $f(x)=x^2+3x$，则 $f'(x)$ 等于？",$x+3$,$2x+3$,$x^2+3$,$2x$,B,5,是
```

学生点击「交卷」后，`app.js` 会把学生选择和标准答案比对，自动算总分、正确题数、错题回看。TeX 公式由 MathJax 渲染。

注意：纯 GitHub Pages 是静态网页，答案在前端文件里。适合课堂练习和作业自测；如果是正式考试，需要服务端判分。

## 用腾讯文档收集题目

推荐用腾讯文档在线表格维护题库，然后导出 CSV 放到这个仓库。

表格第一行用这些列名：

```csv
编号,题干,A,B,C,D,答案,分值,启用
```

示例：

```csv
q1,"设 $f(x)=x^2+3x$，则 $f'(x)$ 等于？",$x+3$,$2x+3$,$x^2+3$,$2x$,B,5,是
```

在腾讯文档里 TeX 直接写 `$\frac{1}{2}$`，不用写成 `\\frac`。导出 CSV 后覆盖仓库里的 `questions.csv`，网页会优先读取它。

`启用` 写 `否`、`0`、`false`、`停用` 时，这一行会被跳过。答案可以写 `A`、`B`、`C`，也可以写 `选项B`。

## 修改设置

常用设置在 `questions.js`：

- `meta.title`：测验标题
- `meta.course`：课程/班级名
- `meta.timeLimitMinutes`：限时分钟数，`0` 表示不限时
- `settings.questionSource`：题库 CSV 路径，默认 `./questions.csv`
- `settings.shuffleQuestions`：是否打乱题目
- `settings.shuffleOptions`：是否打乱选项
- `settings.showCorrectAnswers`：交卷后是否显示正确答案
- `settings.submitEndpoint`：成绩收集地址，空字符串表示不集中收集

答案可以写 `"A"`、`"B"`、`"C"`，也可以写选项下标。建议用字母。

## 放到 GitHub Pages

1. 新建一个 GitHub 仓库，例如 `tex-quiz`
2. 上传本目录里的文件
3. 进入仓库 `Settings` → `Pages`
4. `Build and deployment` 选择 `Deploy from a branch`
5. 选择 `main` 分支和 `/root`
6. 等 GitHub 给出 Pages 地址
7. 把地址生成二维码，学生用微信扫码打开

## 收集全班成绩

GitHub Pages 自己不能保存提交结果。要集中收成绩，可以用 Google 表格：

1. 新建一个 Google Sheet
2. 打开 `Extensions` → `Apps Script`
3. 粘贴 `collect-to-google-sheet.gs` 的内容
4. 点击 `Deploy` → `New deployment`
5. 类型选择 `Web app`
6. `Execute as` 选择自己
7. `Who has access` 选择 `Anyone`
8. 复制部署 URL
9. 把 URL 填到 `questions.js` 的 `settings.submitEndpoint`

配置后，学生交卷时会自动提交到 Google Sheet 的 `Results` 工作表。
