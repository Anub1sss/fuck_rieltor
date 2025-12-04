from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet
import django_filters
from django.db.models import Q, Avg, Min, Max
from .models import Apartment, ParseTask, Source
from .serializers import ApartmentSerializer, ApartmentListSerializer, ParseTaskSerializer
from parser.tasks import start_parse_task


class ApartmentFilter(FilterSet):
    min_price = django_filters.NumberFilter(field_name='price', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='price', lookup_expr='lte')
    min_area = django_filters.NumberFilter(field_name='area', lookup_expr='gte')
    max_area = django_filters.NumberFilter(field_name='area', lookup_expr='lte')
    min_floor = django_filters.NumberFilter(field_name='floor', lookup_expr='gte')
    max_floor = django_filters.NumberFilter(field_name='floor', lookup_expr='lte')
    min_rooms = django_filters.NumberFilter(field_name='rooms', lookup_expr='gte')
    max_rooms = django_filters.NumberFilter(field_name='rooms', lookup_expr='lte')
    
    class Meta:
        model = Apartment
        fields = [
            'source', 'rooms', 'district', 'metro_station', 'is_verified',
            'has_furniture', 'has_appliances', 'has_internet', 'has_parking',
            'has_elevator', 'has_balcony', 'building_type'
        ]


class ApartmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Apartment.objects.filter(is_active=True)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ApartmentFilter
    search_fields = ['address', 'district', 'metro_station', 'description', 'title']
    ordering_fields = ['price', 'area', 'created_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ApartmentListSerializer
        return ApartmentSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        max_floor = self.request.query_params.get('max_floor')
        if max_floor:
            queryset = queryset.filter(floor__lte=max_floor)
        
        building_year = self.request.query_params.get('building_year')
        if building_year:
            queryset = queryset.filter(building_year=building_year)
        
        min_building_year = self.request.query_params.get('min_building_year')
        if min_building_year:
            queryset = queryset.filter(building_year__gte=min_building_year)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def toggle_favorite(self, request, pk=None):
        apartment = self.get_object()
        apartment.is_favorite = not apartment.is_favorite
        apartment.save()
        return Response({'is_favorite': apartment.is_favorite})
    
    @action(detail=False, methods=['get'])
    def favorites(self, request):
        queryset = self.get_queryset().filter(is_favorite=True)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        queryset = self.get_queryset()
        stats = {
            'total': queryset.count(),
            'by_source': {
                source: queryset.filter(source=source).count()
                for source in Source.values
            },
            'avg_price': float(queryset.aggregate(Avg('price'))['price__avg'] or 0),
            'min_price': float(queryset.aggregate(Min('price'))['price__min'] or 0),
            'max_price': float(queryset.aggregate(Max('price'))['price__max'] or 0),
            'avg_area': float(queryset.aggregate(Avg('area'))['area__avg'] or 0),
        }
        return Response(stats)


class ParseTaskViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ParseTask.objects.all()
    serializer_class = ParseTaskSerializer
    ordering = ['-created_at']
    
    @action(detail=False, methods=['post'])
    def start(self, request):
        source = request.data.get('source')
        if source not in Source.values:
            return Response(
                {'error': f'Invalid source. Must be one of: {", ".join(Source.values)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        task = start_parse_task.delay(source)
        return Response({'task_id': task.id, 'source': source})

