from django.urls import path
from . import views

urlpatterns = [
    path('analyze/', views.create_analysis, name='analytics-create'),
]
