from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ApartmentViewSet, ParseTaskViewSet

router = DefaultRouter()
router.register(r'apartments', ApartmentViewSet, basename='apartment')
router.register(r'parse-tasks', ParseTaskViewSet, basename='parse-task')

urlpatterns = [
    path('', include(router.urls)),
]



