import React from "react";
import {Layout, Row, Col, Card, Space, Button, Slider} from "antd"; // Divider
import {HotTable} from '@handsontable/react';
import Plot from "react-plotly.js";
import {ImportOutlined, BarChartOutlined} from "@ant-design/icons"; // PlayCircleOutlined
import Handsontable from "handsontable";

const {Content} = Layout;
const defaultItems = Handsontable.plugins.ContextMenu.DEFAULT_ITEMS;

// 传递 app.js 中的函数和变量
const Dashboard = ({
                       darkMode, plotInputData, hotRef, tableData,
                       setTableData,
                       columns,
                       handleSetHeader,
                       resetData,
                       handleVisualizeClick,
                       handleExponentialSmoothClick,
                       result
                   }) => {
    return (
        <Content className="app-content-fluid">
            {/* 主容器：三栏布局，因为有三个 col */}
            {/* 三个lg的总数应该是24*/}
            <Row gutter={[12, 24]} align="top">

                {/* 左侧栏：操作控制区 (合并原来的两个小 Card) */}
                <Col xs={24} lg={4}>
                    {/*内部使用 <Space orientation="vertical"> 将 Data Actions 卡片和 Analysis 卡片垂直堆叠*/}
                    {/* size 表示 里面 card 的间距 */}
                    <Space orientation="vertical" size={24} style={{width: '100%'}}>

                        {/* 原左侧：Data Actions */}
                        <Card title="Data Actions" className="side-card">
                            <p className={"notice-text"}>
                                You can paste your data directly into the right table or
                                input data from Excel.
                            </p>
                            <Space orientation="vertical" style={{width: '100%'}}>
                                <Button
                                    // type={"primary"}
                                    block
                                    // size="large"
                                    className="common-button"
                                    icon={<ImportOutlined/>}>
                                    Import from Excel
                                </Button>
                                {/*<Divider/>*/}
                                <Button
                                    type="primary"
                                    block
                                    // size="large"
                                    icon={<BarChartOutlined/>}
                                    onClick={handleVisualizeClick}
                                    className="common-button"
                                >Visualize Input</Button>
                            </Space>
                        </Card>

                        {/* 原右侧：Analysis (移动到这里，实现上下排列) */}
                        <Card title="Predictors" className="side-card">
                            <Space orientation="vertical" style={{width: '100%'}}>
                                <Button
                                    // type="primary"
                                    block
                                    // size="large"
                                    // icon={<PlayCircleOutlined/>}
                                    onClick={handleExponentialSmoothClick}
                                    className="common-button"
                                >
                                    Exponential Smoothing
                                </Button>
                            </Space>
                        </Card>

                    </Space>
                </Col>

                {/*中间栏*/}
                <Col xs={24} lg={16}>
                    {/*内部使用 <Space orientation="vertical"> 将 Data Actions 卡片和 Analysis 卡片垂直堆叠*/}
                    <Space orientation="vertical" size={0} style={{width: '100%'}}>
                        {/* 左侧表格部分 */}
                        <Card
                            // title="Data Editor (Excel Style)"
                            className="main-card"
                            style={{flex: 1, minWidth: 0}} // 关键点：flex: 1 让它撑满，minWidth: 0 防止 Flex 溢出
                        >
                            <div className="excel-editor-container">
                                <HotTable
                                    ref={hotRef}
                                    data={tableData}
                                    colHeaders={columns}
                                    afterChange={(changes) => {
                                        if (changes) {
                                            const updatedData = hotRef.current.hotInstance.getData();
                                            setTableData(updatedData);
                                        }
                                    }}
                                    rowHeaders={true}
                                    height="262px"
                                    width="100%"
                                    licenseKey="non-commercial-and-evaluation"
                                    selectionMode="multiple"
                                    dragToFill={true}
                                    copyPaste={true}
                                    stretchH={'last'}
                                    className="custom-handsontable"
                                    contextMenu={{
                                        items: {
                                            ...defaultItems.reduce((acc, key) => {
                                                acc[key] = {};
                                                return acc;
                                            }, {}),
                                            "---------": {},
                                            rename_header: {
                                                name: "Rename column head",
                                                hidden: function () {
                                                    const selected = this.getSelectedLast();
                                                    if (!selected) return true;
                                                    return selected[0] !== -1;
                                                },
                                                callback: function (key, selection) {
                                                    const col = selection[0].start.col;
                                                    const headers = this.getColHeader();
                                                    const newName = prompt("New column head", headers[col]);
                                                    if (newName) {
                                                        headers[col] = newName;
                                                        this.updateSettings({colHeaders: headers});
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </Card>

                        {/* 下方：可视化结果 (只有在 result 存在时显示) */}
                        {result && (
                            <Card
                                // title="Visualization"
                                className="plot-card">
                                <div style={{display: 'flex', justifyContent: 'center'}}>
                                    <Plot
                                        data={result.data}
                                        revision={Date.now()} // 关键：强制 Plotly 识别更新
                                        layout={{
                                            autosize: true,
                                            showlegend: true,
                                            height: 320, // 稍微调整高度以适应布局
                                            paper_bgcolor: 'transparent',
                                            plot_bgcolor: 'transparent',
                                            font: {color: darkMode ? '#eee' : '#333'},
                                            margin: {t: 30, r: 30, b: 50, l: 60},
                                            xaxis: {
                                                // 修正：增加 text 键，并提供后备默认值
                                                title: {
                                                    text: result.xAxisName || "Time index"
                                                },
                                                showline: true,
                                                linecolor: darkMode ? '#d5cece' : '#302e2e',
                                                linewidth: 2,
                                                autorange: true,
                                                zeroline: false,
                                            },
                                            yaxis: {
                                                title: {text: "Value"},
                                                showline: true,
                                                linecolor: darkMode ? '#d5cece' : '#302e2e',
                                                linewidth: 2,
                                                autorange: true,
                                                zeroline: false,
                                            },
                                        }}
                                        useResizeHandler={true}
                                        style={{width: "100%", height: "100%"}}
                                    />
                                </div>
                            </Card>
                        )}
                    </Space>
                </Col>

                {/*右侧栏*/}
                <Col xs={24} lg={4}>
                    <Space orientation="vertical" size={24} style={{width: '100%'}}>
                        <Card className="side-card">
                            <Space orientation="vertical" style={{width: '100%'}}>
                                <Button block onClick={handleSetHeader}
                                    // size={"large"}
                                        className="common-button"
                                >
                                    Set first row as headers
                                </Button>
                                {/*<Divider/>*/}
                                <Button block onClick={resetData}
                                    // size={"large"}
                                        className="common-button"
                                >
                                    Reset to default data
                                </Button>
                            </Space>
                        </Card>

                        <Card className="side-card parameter" title={"Parameters"}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                <span>α:</span>
                                <div style={{flex: 1}}> {
                                    <Slider
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        marks={{0: '0', 1: '1'}}
                                        // onChange={onChange}
                                        value={0.5}
                                    />
                                }
                                </div>
                            </div>
                        </Card>
                    </Space>
                </Col>
            </Row>
        </Content>
    );
};

export default Dashboard;