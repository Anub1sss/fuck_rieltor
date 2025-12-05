from celery import shared_task
from django.utils import timezone
from django.conf import settings
import requests
import logging
from api.models import ParseTask, Apartment, Source, ParseLog

logger = logging.getLogger(__name__)


@shared_task
def start_parse_task(source):
    task = ParseTask.objects.create(source=source, status='pending')
    
    try:
        task.status = 'running'
        task.started_at = timezone.now()
        task.save()
        
        parser_url = f"{settings.PARSER_SERVICE_URL}/parse/{source}"
        response = requests.post(parser_url, timeout=600)  # 10 минут для парсинга 10 страниц
        
        if response.status_code == 200:
            data = response.json()
            task.apartments_found = data.get('found', 0)
            task.apartments_new = data.get('new', 0)
            task.apartments_updated = data.get('updated', 0)
            task.status = 'completed'
        else:
            task.status = 'failed'
            task.error_message = f"Parser service error: {response.status_code} - {response.text}"
        
    except Exception as e:
        logger.error(f"Parse task failed: {e}", exc_info=True)
        task.status = 'failed'
        task.error_message = str(e)
    
    finally:
        task.completed_at = timezone.now()
        task.save()
    
    return task.id


def update_apartments_from_parser(source, apartments_data):
    new_count = 0
    updated_count = 0
    
    for apt_data in apartments_data:
        external_id = apt_data.get('external_id')
        if not external_id:
            continue
        
        apartment, created = Apartment.objects.update_or_create(
            source=source,
            external_id=external_id,
            defaults={
                'url': apt_data.get('url', ''),
                'price': apt_data.get('price', 0),
                'area': apt_data.get('area'),
                'rooms': apt_data.get('rooms'),
                'floor': apt_data.get('floor'),
                'total_floors': apt_data.get('total_floors'),
                'district': apt_data.get('district'),
                'metro_station': apt_data.get('metro_station'),
                'address': apt_data.get('address'),
                'description': apt_data.get('description'),
                'title': apt_data.get('title'),
                'contact_phone': apt_data.get('contact_phone'),
                'contact_name': apt_data.get('contact_name'),
                'is_owner': apt_data.get('is_owner', True),
                'no_commission': apt_data.get('no_commission', True),
                'photos': apt_data.get('photos', []),
                'infrastructure': apt_data.get('infrastructure', {}),
                'building_year': apt_data.get('building_year'),
                'building_type': apt_data.get('building_type'),
                'living_area': apt_data.get('living_area'),
                'kitchen_area': apt_data.get('kitchen_area'),
                'deposit': apt_data.get('deposit'),
                'commission': apt_data.get('commission'),
                'utilities_included': apt_data.get('utilities_included', False),
                'rental_period': apt_data.get('rental_period'),
                'metro_distance': apt_data.get('metro_distance'),
                'metro_transport': apt_data.get('metro_transport'),
                'published_date': apt_data.get('published_date'),
                'has_furniture': apt_data.get('has_furniture', False),
                'has_appliances': apt_data.get('has_appliances', False),
                'has_internet': apt_data.get('has_internet', False),
                'has_parking': apt_data.get('has_parking', False),
                'has_elevator': apt_data.get('has_elevator', False),
                'has_balcony': apt_data.get('has_balcony', False),
                'features': apt_data.get('features', []),
                'parsed_at': timezone.now(),
                'is_active': True,
            }
        )
        
        if created:
            new_count += 1
        else:
            updated_count += 1
    
    return {'new': new_count, 'updated': updated_count}

