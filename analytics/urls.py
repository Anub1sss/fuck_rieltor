from django.urls import path
from . import views

urlpatterns = [
    path('analyze/', views.create_analysis, name='analytics-create'),
    path('analyses/', views.list_analyses, name='analytics-list'),
    path('analyses/<uuid:analysis_id>/', views.get_analysis, name='analytics-detail'),
]
