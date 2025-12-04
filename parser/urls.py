from django.urls import path
from . import views

urlpatterns = [
    path('', views.parser_root, name='parser-root'),
    path('update-apartments/', views.update_apartments, name='update-apartments'),
]



