import React, {useState, useRef} from "react";
import Plot from "react-plotly.js";
import {Layout, Menu, Button, Tooltip, Row, Col, Card, Divider, Space, message} from "antd";
import {SunOutlined, MoonOutlined, ImportOutlined, PlayCircleOutlined, DeleteOutlined} from "@ant-design/icons";
import {HotTable} from '@handsontable/react';
import {registerAllModules} from 'handsontable/registry';
import {BarChartOutlined, /* ... 其他图标 */} from "@ant-design/icons"; // 记得引入图标

// 注意：如果 import 报错，请使用此路径或在 index.html 引入 CDN
// import 'handsontable/dist/handsontable.full.css';
import './styles/App.css';

registerAllModules();
const {Header, Content, Footer} = Layout;

function App() {
    const [result, setResult] = useState(null);
    const [darkMode, setDarkMode] = useState(true);
    const hotRef = useRef(null);

    // 初始数据
    const initialData = [
        ['2024-01-01', 100, '', ''],
        ['2024-01-02', 120, '', ],
        ['', '', '', ''],
    ];
    // 创建一个能被 React 监测到的数据仓库: 变动的数据集和数据修改函数
    const [tableData, setTableData] = useState(initialData);

    // --- 功能逻辑 ---

    // 运行预测
    const runPrediction = async () => {
        const tableData = hotRef.current.hotInstance.getData();
        const cleanData = tableData.filter(row => row[0] && row[1]);
        if (cleanData.length === 0) return message.warning("请先输入有效数据！");

        try {
            const res = await fetch("http://127.0.0.1:8000/predict", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({data: cleanData}),
            });
            const json = await res.json();
            setResult(json);
            message.success("预测完成！");
        } catch (error) {
            message.error("预测请求失败，请检查后端服务。");
        }
    };

    // 可视化当前的输入数据（不运行预测模型）
    const plotInputData = (e) => {

        // 1. 从 Handsontable 引用中获取实时数据实例
        const hotInstance = hotRef.current.hotInstance;
        // 获取所有数据（二维数组格式）
        const tableData = hotInstance.getData();

        // 2. 数据清洗：过滤掉日期(col 0)或数值(col 1)为空的无效行
        const cleanData = tableData.filter(row => row[0] && row[1]);

        // 3. 基本校验：如果没有有效数据，提示用户，不进行后续操作
        if (cleanData.length === 0) {
            return message.warning("Table is empty. Please enter or paste data first.");
        }

        // 4. 数据格式化：将二维数组转为 Plotly 所需的 X (时间轴) 和 Y (数值轴) 数组
        const times = cleanData.map(row => row[0]); // 提取第一列作为时间/索引
        const values = cleanData.map(row => row[1]); // 提取第二列作为数值

        // 5. 构造一个专用于展示原数据的“结果”对象
        // 我们只填充 time 和 value，将 pred (预测值) 设为空数组
        // 这样下面的绘图组件就会只画出“真实值”那条线
        const inputDataVisualization = {
            time: times,
            value: values,
            pred: [], // 这里是关键，设为空，表示此时没有预测结果
        };

        // 6. 更新状态，触发页面下方的 <Plot /> 组件重新渲染
        setResult(inputDataVisualization);

        // 7. 提供用户反馈
        message.success(`Successfully visualized ${cleanData.length} data points.`);
    };

    // 清除数据
    const clearData = () => {
        hotRef.current.hotInstance.loadData([['', '']]);
        setResult(null);
    };

    const toggleTheme = () => setDarkMode(!darkMode);

    return (
        <Layout className={darkMode ? "dark" : "light"}>
            <Header className={`app-header ${darkMode ? "dark" : "light"}`}>
                <div className="header-container">
                    {/* 左侧：Logo */}
                    <div className="header-left">
                        <div className="header-logo">Dr Zhen Chen's Forecaster</div>
                    </div>

                    {/* --- 重点：重新找回的翻译插件容器 --- */}
                    <div className="header-center">
                        <div id="google_translate_element"></div>
                    </div>
                    {/* ---------------------------------- */}

                    <div className="header-right">
                        <Space size="large">
                            <Menu  theme={darkMode ? "dark" : "light"} mode="horizontal" defaultSelectedKeys={["1"]}>
                                <Menu.Item key="1">Dashboard</Menu.Item>
                                <Menu.Item key="2">About</Menu.Item>
                            </Menu>
                            <Tooltip title="Switch Theme">
                                <Button type="text" onClick={toggleTheme} className={"theme-button"}
                                        icon={darkMode ? <SunOutlined/> : <MoonOutlined/>}/>
                            </Tooltip>
                        </Space>
                    </div>
                </div>
            </Header>

            <Content className="app-content-fluid">
                {/* 使用 Ant Design Row 构建三栏布局 */}
                <Row gutter={[24, 24]} align="top">

                    {/* 左侧：数据处理区 */}
                    <Col xs={24} lg={5}>
                        <Card title="Data Actions" className="side-card">
                            <Space orientation={"vertical"} style={{width: '100%'}}>
                                <Button type={"primary"} className="run-button-gradient" block icon={<ImportOutlined/>}>Import Excel</Button>
                                <Divider style={{margin: '12px 0'}}/>
                                <Button type={"primary"} className="run-button-gradient" block danger icon={<DeleteOutlined/>} onClick={clearData}>
                                    Clear All
                                </Button>
                            </Space>
                        </Card>
                    </Col>

                    {/* 中间：Handsontable 显示区 */}
                    <Col xs={24} lg={14}>
                        <Card title="Data Editor (Excel Style)" className="main-card">
                            <div className="excel-editor-container">
                                <HotTable
                                    ref={hotRef}
                                    data={tableData}
                                    afterChange={(changes) => {
                                        if (changes) {
                                            // 当用户粘贴或修改数据时，立即更新 tableData 状态
                                            // 这样重新渲染时，数据就能保持住
                                            const updatedData = hotRef.current.hotInstance.getData();
                                            setTableData(updatedData);
                                        }
                                    }}
                                    colHeaders={['Date index', 'Value']}
                                    rowHeaders={true}
                                    width="100%"
                                    height="400px"
                                    colWidths={[250, 150]}
                                    manualColumnResize={true}
                                    licenseKey="non-commercial-and-evaluation"
                                    selectionMode="multiple"
                                    dragToFill={true}
                                    copyPaste={true}
                                    contextMenu={true}
                                    className="custom-handsontable"
                                />
                            </div>
                        </Card>
                    </Col>

                    {/* 右侧：预测控制区 */}
                    <Col xs={24} lg={5}>
                        <Card title="Analysis" className="side-card">
                            <p style={{fontSize: '12px', color: '#888'}}>
                                Ensure your data has at least 2 points for basic trend analysis.
                            </p>
                            <Space orientation={"vertical"} style={{width: '100%'}}>
                                <Button
                                    type="primary"
                                    block
                                    // size="large"
                                    icon={<BarChartOutlined/>}
                                    onClick={plotInputData} // 绑定新的处理函数
                                    className="run-button-gradient"
                                >
                                    Visualize Input
                                </Button>
                                <Button
                                    type="primary"
                                    block
                                    size="large"
                                    icon={<PlayCircleOutlined/>}
                                    onClick={runPrediction}
                                    className="run-button-gradient"
                                >
                                    Run Predictor
                                </Button>
                            </Space>
                        </Card>
                    </Col>
                </Row>

                {/* 下方：全屏展示预测图表 */}
                {result && (
                    <Row style={{marginTop: '24px'}}>
                        <Col span={24}>
                            <Card title="Visualization" bordered={false} className="plot-card">
                                <div style={{display: 'flex', justifyContent: 'center'}}>
                                    <Plot
                                        data={[
                                            {
                                                x: result.time,
                                                y: result.value,
                                                type: "scatter",
                                                mode: "lines+markers",
                                                name: "Actual",
                                            },
                                            {
                                                x: result.time,
                                                y: result.pred,
                                                type: "scatter",
                                                mode: "lines",
                                                name: "Predicted",
                                                line: {dash: 'dot', color: '#818cf8'}
                                            },
                                        ]}
                                        layout={{
                                            autosize: true,
                                            width: 1000,
                                            height: 500,
                                            paper_bgcolor: 'transparent',
                                            plot_bgcolor: 'transparent',
                                            font: {color: darkMode ? '#eee' : '#333'},
                                            margin: {l: 50, r: 50, b: 50, t: 50}
                                        }}
                                        useResizeHandler={true}
                                        style={{width: "100%", height: "100%"}}
                                    />
                                </div>
                            </Card>
                        </Col>
                    </Row>
                )}
            </Content>

            <Footer className="app-footer">An online forecaster ©Dr Zhen Chen 2026</Footer>
        </Layout>
    );
}

export default App;