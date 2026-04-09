from fastapi import FastAPI
from pydantic import BaseModel
from statsmodels.tsa.holtwinters import SimpleExpSmoothing
import pandas as pd

app = FastAPI()

class PlotData(BaseModel):
    y_values: list
    forecast_steps: int = 5

@app.post("/predict")
async def predict(data: PlotData):
    # 1. 转化为 Series
    series = pd.Series(data.y_values)

    # 2. 拟合简单的指数平滑模型
    # initialization_method="estimated" 会让 Python 自动寻找最佳的 alpha
    model = SimpleExpSmoothing(series, initialization_method="estimated").fit()

    # 3. 获取拟合值（历史平滑）和预测值（未来）
    fitted_values = model.fittedvalues.tolist()
    forecast_values = model.forecast(data.forecast_steps).tolist()

    return {
        "fitted": fitted_values,
        "forecast": forecast_values,
        "alpha": model.model.params['smoothing_level'] # 返回自动计算的 alpha
    }