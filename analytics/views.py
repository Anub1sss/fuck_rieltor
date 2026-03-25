from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.models import Apartment
from .models import FamilyProfile, ApartmentAnalysis
from .serializers import (
    AnalysisRequestSerializer,
    ApartmentAnalysisDetailSerializer,
)
from .services import (
    detect_source,
    analyze_apartment,
    populate_from_existing_apartment,
    populate_from_url_stub,
)


@api_view(['POST'])
def create_analysis(request):
    ser = AnalysisRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    profile = FamilyProfile.objects.create(
        buyer_type=data.get('buyer_type', 'couple'),
        husband_work_address=data.get('husband_work_address', ''),
        wife_work_address=data.get('wife_work_address', ''),
        has_children=data.get('has_children', False),
        children_school_address=data.get('children_school_address', ''),
        children_kindergarten_address=data.get('children_kindergarten_address', ''),
        has_car=data.get('has_car', False),
        has_pets=data.get('has_pets', False),
        priority_transport=data.get('priority_transport', True),
        priority_ecology=data.get('priority_ecology', True),
        priority_infrastructure=data.get('priority_infrastructure', True),
        priority_safety=data.get('priority_safety', True),
        priority_quietness=data.get('priority_quietness', True),
        max_commute_minutes=data.get('max_commute_minutes', 60),
    )

    source_url = data['source_url']
    source_type = detect_source(source_url)

    analysis = ApartmentAnalysis.objects.create(
        family_profile=profile,
        source_url=source_url,
        source_type=source_type,
    )

    existing = _find_existing_apartment(source_url)
    if existing:
        populate_from_existing_apartment(analysis, existing)
    else:
        populate_from_url_stub(analysis)

    analysis.refresh_from_db()
    if not analysis.price and not analysis.area:
        analysis.delete()
        profile.delete()
        return Response(
            {'detail': 'Не удалось загрузить данные квартиры. Проверьте ссылку — она должна вести на страницу конкретного объявления на Циан, Авито или Яндекс.Недвижимость.'},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    analyze_apartment(analysis)

    result = ApartmentAnalysisDetailSerializer(analysis).data

    # Don't keep history — delete after serializing
    try:
        analysis.delete()
        profile.delete()
    except Exception:
        pass

    return Response(result, status=status.HTTP_200_OK)


def _find_existing_apartment(url: str):
    try:
        return Apartment.objects.filter(url=url).first()
    except Exception:
        return None
