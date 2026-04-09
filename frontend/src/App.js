import React, {useState, useRef} from "react";
import {Layout, Menu, Button, Tooltip, Space, message, Modal, Select, Form, ConfigProvider, theme, Divider} from "antd";
import {SunOutlined, MoonOutlined} from "@ant-design/icons";
import {registerAllModules} from 'handsontable/registry';
import {useNavigate, Routes, Route, Navigate} from "react-router-dom";
// 导入分出去的组件，即js文件
import Dashboard from './dashboard';
import AboutPage from './about';

// 注意：如果 import 报错，请使用此路径或在 index.html 引入 CDN
// import 'handsontable/dist/handsontable.full.css';
import './styles/App.css';


registerAllModules(); // handsontable

const {Header, Footer} = Layout;

function App() {
    const navigate = useNavigate();

    const [result, setResult] = useState(null);
    // 右边小括号的内容为左边第一个变量，传递到函数的值，函数名为第二个元素
    const [darkMode, setDarkMode] = useState(false);
    const hotRef = useRef(null);

    const [activeModal, setActiveModal] = useState(null); // 存储当前的 Modal ID
    // 关闭弹窗的统一方法
    const closeModal = () => setActiveModal(null);
    const [columnOptions, setColumnOptions] = useState([]); // 存储列名
    const [xAxis, setXAxis] = useState(null);               // 横轴选中的列
    const [yAxes, setYAxes] = useState([]);                 // 纵轴选中的列（多选）

    // 初始数据
    const initialData = [
        ['1', 20, ''],
        ['2', 27, ''],
        ['3', 25, ''],
        ['4', 22, ''],
        ['5', 18, ''],
        ['6', 21, ''],
        ['7', 26, ''],
        ['8', 19, ''],
        ['9', 16, ''],
        ['10', 28, ''],
        ['11', 25, ''],
        ['12', 24, '',],
        ['13', 17, ''],
        ['14', 23, ''],
        ['15', 27, '']
    ];// 创建一个能被 React 监测到的数据仓库: 变动的数据集和数据修改函数
    const initialColumns = ['Week', 'Calls', '', ''];
    const [tableData, setTableData] = useState(initialData);
    const [columns, setColumns] = useState(initialColumns);


    // --- 功能逻辑 ---
    const toggleTheme = () => {
        setDarkMode(!darkMode);
    }

    const resetData = () => {
        // initialData 是你最初定义的那个空数组或默认数组
        setTableData([...initialData]);
        setColumns([...initialColumns]);
    };

    // 更改表头名字
    const handleSetHeader = () => {
        const hotInstance = hotRef.current.hotInstance;
        const currentData = hotInstance.getData(); // 获取当前表格所有数据

        if (currentData.length > 0) {
            const newHeaders = currentData[0]; // 取第一行作为新标题
            const remainingData = currentData.slice(1); // 剩下的是数据部分

            // 更新状态或直接更新 Handsontable 设置
            hotInstance.updateSettings({
                colHeaders: newHeaders,
                data: remainingData
            });
            setTableData(remainingData);
            setColumns(newHeaders);
        }
    };

    const handleVisualizeClick = () => {
        // 从 Handsontable 实例获取最新的列头
        const headers = hotRef.current.hotInstance.getColHeader();
        const options = headers.map((header, index) => ({
            label: header || `Column ${index + 1}`,
            value: index // 存索引，方便后面取数据
        }));

        setColumnOptions(options);
        setActiveModal('visualization');
    };

    const handleExponentialSmoothClick = () => {
        // 从 Handsontable 实例获取最新的列头
        const headers = hotRef.current.hotInstance.getColHeader();
        const options = headers.map((header, index) => ({
            label: header || `Column ${index + 1}`,
            value: index // 存索引，方便后面取数据
        }));

        setColumnOptions(options);
        setActiveModal('exponential-smoothing');
    };

    const handleExponentialSmooth = async (yAxes) => {
        const hot = hotRef.current.hotInstance;
        // 从 Handsontable 实例获取最新的列头
        const headers = hot.getColHeader();
        const options = headers.map((header, index) => ({
            label: header || `Column ${index + 1}`,
            value: index // 存索引，方便后面取数据
        }));

        setColumnOptions(options);
        setActiveModal('exponential-smoothing');

        // yAxes 存储的是被选中的列索引
        if (!yAxes) {
            message.warning("Please select one column for prediction");
            return;
        }

        const targetColIndex = yAxes;
        const rawData = hot.getDataAtCol(targetColIndex);

        // 过滤掉非数字或空值，转为浮点数
        const numericData = rawData
            .map(val => parseFloat(val))
            .filter(val => !isNaN(val));

        try {
            // 调用 Pyodide 运行 Python 代码
            // 假设 pyodide 已经初始化好，并且安装了 statsmodels
            const pyodide = window.pyodide;

            // 将 JS 数组传给 Python
            pyodide.globals.set("input_data", numericData);

            const pythonCode = `
import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing

# 转换数据
data = np.array(input_data)

# 执行简单指数平滑 (Simple Exponential Smoothing)
# 你也可以根据需求改为 Holt (trend='add') 或 Holt-Winters (seasonal='add')
model = ExponentialSmoothing(data, initialization_method="estimated").fit()
forecast = model.forecast(5)  # 预测未来 5 个点

# 返回结果给 JS
forecast.tolist()
        `;

            const forecastResults = await pyodide.runPythonAsync(pythonCode);

            // 3. 将预测结果添加到 Handsontable
            // 方案：在原数据末尾追加行，或者新增一列
            const lastRow = hot.countRows();

            // 简单的演示：将预测值追加到目标列的末尾
            const changes = forecastResults.map((val, i) => [lastRow + i, targetColIndex, val.toFixed(2)]);
            hot.setDataAtCell(changes);

            message.success("Prediction completed and added to table!");
            setActiveModal(null); // 关闭弹窗

        } catch (error) {
            console.error("Python Error:", error);
            message.error("Prediction failed. Make sure statsmodels is loaded.");
        }
    };

    // 可视化当前的输入数据（不运行预测模型）
    const plotInputData = (xIdx, yIdxArray) => {
        if (xIdx === null || !yIdxArray || yIdxArray.length === 0) {
            message.warning("Please select both X and Y columns").then(r => '');
            return;
        }

        // 从 Handsontable 引用中获取实时数据实例
        const hotInstance = hotRef.current.hotInstance;
        // 获取所有数据（二维数组格式）
        const tableData = hotInstance.getData(); // 获取所有行的数据 [[row1], [row2]...]

        // 数据清洗：过滤掉空的无效行
        const cleanData = tableData.filter(row => {
                // 检查 X 轴列是否有值
                const hasX = row[xIdx] !== null && row[xIdx] !== '';
                // 检查所有选中的 Y 轴列是否有值 (使用 every 确保全都有值，或用 some 只要有一个有值)
                const hasY = yIdxArray.some(yIdx => row[yIdx] !== null && row[yIdx] !== '');

                return hasX && hasY;
            }
        );

        // 基本校验：如果没有有效数据，提示用户，不进行后续操作
        if (cleanData.length === 0) {
            return message.warning("Table is empty. Please enter or paste data first.");
        }

        // 构造 Plotly 需要的数据格式
        const traces = yIdxArray.map(yIdx => {
            return {
                // 第一个参数：当前元素的值（value)
                // 第二个参数：当前元素的索引（index）
                // 第三个参数：原数组本身（array
                x: cleanData.map((_, index) =>
                    xIdx === 'default_index' ? index + 1 : cleanData[index][xIdx]
                ),
                y: cleanData.map(row => {
                    const val = row[yIdx];
                    // 尝试转换为数字，如果转换失败则保持原样（针对非数值轴）
                    return isNaN(parseFloat(val)) ? val : parseFloat(val);
                }),
                name: columnOptions[yIdx].label,
                type: 'scatter',
                mode: 'lines+markers'
            };
        });

        // 获取选中的 X 轴列名
        const selectedXName = xIdx === 'default_index'
            ? "Time index"
            : (columnOptions.find(opt => opt.value === xIdx)?.label || "Time index");
        // 更新你的 result 状态，让 Plot 组件渲染
        setResult({
            isCustomPlot: true,
            data: traces,
            xAxisName: selectedXName, // 新增：保存选中的 X 轴标题
        });

        // 提供用户反馈
        message.success(`Successfully visualized ${cleanData.length} data points.`).then(r => '');
    };

    return (
        // 1. 用 ConfigProvider 包裹整个应用或 Modal 所在区域
        <ConfigProvider
            theme={{
                // 2. 根据你的变量决定使用哪种算法
                algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
                token: {
                    // 试试这个紫色，或者换成你喜欢的任何颜色
                    colorPrimary: darkMode ? '#440bb5' : '#6d5995',
                },
            }}
        >

            <Layout className={darkMode ? "dark" : "light"}>

                <Header className={`app-header ${darkMode ? "dark" : "light"}`}>
                    <div className="header-container">
                        {/* 左侧：Logo */}
                        <div className="header-left">
                            <div className="header-logo"
                                 style={{cursor: 'pointer'}}   // 鼠标悬停显示手型，提示可点击
                                 onClick={() => navigate("/")}   // 点击回到 Dashboard
                            >Dr Zhen Chen's Forecaster
                            </div>
                        </div>

                        {/* --- 重点：重新找回的翻译插件容器 --- */}
                        <div className="header-center">
                            <div id="google_translate_element"></div>
                        </div>
                        {/* ---------------------------------- */}

                        <div className="header-right">
                            <Space
                                // size="large"
                            >
                                <Menu theme={darkMode ? "dark" : "light"} mode="horizontal"
                                    // 使用路径作为 key，刷新页面也能正确高亮
                                      selectedKeys={[window.location.pathname]}
                                      onClick={({key}) => navigate(key)}
                                >
                                    <Menu.Item key="/">Home</Menu.Item>
                                    <Menu.Item key="/about">About</Menu.Item>
                                </Menu>

                                <Tooltip title="Switch Theme">
                                    <Button type="text" onClick={toggleTheme} className={"theme-button"}
                                            icon={darkMode ? <SunOutlined/> : <MoonOutlined/>}/>
                                </Tooltip>
                            </Space>
                        </div>
                    </div>
                </Header>

                {/*弹窗组件*/}
                <Modal
                    title="Select Columns for Visualization"
                    destroyOnHidden={true} //  每次打开都重新初始化内部组件
                    open={activeModal === 'visualization'}
                    onOk={() => {
                        plotInputData(xAxis, yAxes); // 确认时执行绘图逻辑
                        closeModal();
                    }}
                    onCancel={closeModal}
                >
                    <div
                        // style={{marginBottom: 16}}
                    >
                        <p>Select X-Axis (Horizontal):</p>
                        <Select
                            style={{width: '75%'}}
                            placeholder="Choose one column"
                            options={[
                                {label: 'Default (1, 2, 3...)', value: 'default_index'},
                                // ... 叫做扩展运算符，把数组里的每个元素展开放到新数组里
                                ...columnOptions
                            ]}
                            onChange={(val) => setXAxis(val)}
                        />
                    </div>
                    <div>
                        <p>Select Y-Axis (Verticals):</p>
                        <Select
                            mode="multiple" // 允许多选
                            style={{width: '75%'}}
                            placeholder="Choose one or more columns"
                            options={columnOptions}
                            onChange={(val) => setYAxes(val)}
                        />
                    </div>
                </Modal>

                <Modal
                    title="Exponential Smoothing Settings"
                    destroyOnHidden={true} //  每次打开都重新初始化内部组件
                    open={activeModal === 'exponential-smoothing'}
                    onOk={() => {
                        handleExponentialSmooth(yAxes); // 确认时执行绘图逻辑
                        closeModal();
                    }}
                    onCancel={closeModal}
                >
                    <Form
                        layout="horizontal"
                        // labelCol={{ span: 6 }}   // 文字占多宽
                        // wrapperCol={{ span: 18 }} // 下拉框占多宽
                    >
                        <Form.Item label="Select time index">
                            <Select
                                placeholder="Choose one column"
                                options={[{label: 'Default (1, 2, 3...)', value: 'default_index'}, ...columnOptions]}
                                onChange={setXAxis}
                            />
                        </Form.Item>

                        <Form.Item label="Select data for prediction">
                            <Select
                                // mode="multiple"
                                maxTagCount="responsive"
                                options={columnOptions}
                                onChange={setYAxes}
                            />
                        </Form.Item>
                    </Form>
                    <Divider/>
                </Modal>

                {/* 2. 核心修复：Routes 应该放在这里，控制主体内容的切换 */}
                <Routes>
                    <Route path="/" element={
                        <Dashboard
                            darkMode={darkMode}
                            plotInputData={plotInputData}
                            hotRef={hotRef}
                            tableData={tableData}
                            setTableData={setTableData} // <--- 确保这里也写了传递逻辑
                            columns={columns}
                            handleSetHeader={handleSetHeader}
                            resetData={resetData}
                            handleVisualizeClick={handleVisualizeClick}
                            handleExponentialSmoothClick={handleExponentialSmoothClick}
                            result={result}
                        />
                    }/>
                    <Route path="/about" element={<AboutPage/>}/>
                    <Route path="*" element={<Navigate to="/" replace/>}/> {/* 所有未匹配的都跳到 Dashboard */}
                </Routes>

                <Footer className="app-footer">An online forecaster ©Dr Zhen Chen 2026</Footer>
            </Layout>
        </ConfigProvider>);
}

export default App;