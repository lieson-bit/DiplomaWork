"""
Демонстрация алгоритма GreedyFeasibilityCheck
Многомерная задача о рюкзаке для сопоставления водителя и заказов
На основе примера из раздела 2.2.1.3
"""

# Ограничения водителя
driver_weight_limit = 500  # килограммов
driver_volume_limit = 3.0   # кубических метров

# Данные заказов: вес_кг, объём_м³, стоимость_руб
orders = {
    1: {"weight": 200, "volume": 0.54, "cost": 800},
    2: {"weight": 150, "volume": 0.8, "cost": 600},
    3: {"weight": 100, "volume": 0.26, "cost": 500},
    4: {"weight": 250, "volume": 1.43, "cost": 900},
    5: {"weight": 180, "volume": 0.23, "cost": 700}
}

print("=" * 70)
print("ЭТАП 1: ДАННЫЕ ЗАКАЗОВ И РАСЧЁТ ПЛОТНОСТИ")
print("=" * 70)
print("Заказ | Вес | Объём | Стоимость | Плотность")
for order_id, data in orders.items():
    weight = data["weight"]
    volume = data["volume"]
    cost = data["cost"]
    density = cost / (weight * volume)
    print(f"  {order_id}   |   {weight}   |   {volume}   |   {cost}   |   {density:.2f}")

# Этап 1: Сортировка по плотности (от наибольшей к наименьшей)
order_list = []
for order_id, data in orders.items():
    order_list.append({
        "id": order_id,
        "weight": data["weight"],
        "volume": data["volume"],
        "cost": data["cost"],
        "density": data["cost"] / (data["weight"] * data["volume"])
    })
sorted_orders = sorted(order_list, key=lambda x: x["density"], reverse=True)

print("\n" + "=" * 70)
print("ЭТАП 2: СОРТИРОВКА ЗАКАЗОВ ПО ПЛОТНОСТИ (от наибольшей к наименьшей)")
print("=" * 70)
print("Заказ | Вес | Объём | Стоимость | Плотность")
for order in sorted_orders:
    print(f"  {order['id']}   |   {order['weight']}   |   {order['volume']}   |   {order['cost']}   |   {order['density']:.2f}")

# Этап 2: Жадный отбор с проверкой выполнимости
print("\n" + "=" * 70)
print("ЭТАП 3: ЖАДНЫЙ ОТБОР С ПРОВЕРКОЙ ВЫПОЛНИМОСТИ")
print("=" * 70)

selected_orders = []
current_weight = 0
current_volume = 0
total_cost = 0

print("Шаг | Заказ | Принят? | Причина")
print("-" * 40)

for step, order in enumerate(sorted_orders, 1):
    order_id = order["id"]
    new_weight = current_weight + order["weight"]
    new_volume = current_volume + order["volume"]
    
    if new_weight <= driver_weight_limit and new_volume <= driver_volume_limit:
        selected_orders.append(order)
        current_weight = new_weight
        current_volume = new_volume
        total_cost += order["cost"]
        print(f"  {step}   |   {order_id}   |   ДА     |   добавлен")
    else:
        reason = ""
        if new_weight > driver_weight_limit:
            reason = f"вес превысит {driver_weight_limit} кг"
        elif new_volume > driver_volume_limit:
            reason = f"объём превысит {driver_volume_limit} м³"
        print(f"  {step}   |   {order_id}   |   НЕТ    |   {reason}")

print("\n" + "=" * 70)
print("РЕЗУЛЬТАТ ЖАДНОГО ОТБОРА")
print("=" * 70)
print(f"Выбранные заказы: {[o['id'] for o in selected_orders]}")
print(f"Общий вес: {current_weight} кг (лимит: {driver_weight_limit} кг)")
print(f"Общий объём: {current_volume:.2f} м³ (лимит: {driver_volume_limit} м³)")
print(f"Общая стоимость: {total_cost} рублей")

# Этап 3: Локальная оптимизация через замену
print("\n" + "=" * 70)
print("ЭТАП 4: ЛОКАЛЬНАЯ ОПТИМИЗАЦИЯ (попытки замены)")
print("=" * 70)

all_ids = set(orders.keys())
selected_ids = set([o["id"] for o in selected_orders])
rejected_ids = all_ids - selected_ids

print(f"Выбранные заказы: {sorted(selected_ids)}")
print(f"Отклонённые заказы: {sorted(rejected_ids)}")
print()

best_improvement = 0
best_swap = None

for selected_id in selected_ids:
    for rejected_id in rejected_ids:
        selected_order = next((o for o in selected_orders if o["id"] == selected_id), None)
        rejected_order = next((o for o in order_list if o["id"] == rejected_id), None)
        
        temp_weight = current_weight - selected_order["weight"] + rejected_order["weight"]
        temp_volume = current_volume - selected_order["volume"] + rejected_order["volume"]
        temp_cost = total_cost - selected_order["cost"] + rejected_order["cost"]
        
        is_feasible = (temp_weight <= driver_weight_limit) and (temp_volume <= driver_volume_limit)
        improvement = temp_cost - total_cost
        
        print(f"Замена заказа {selected_id} на заказ {rejected_id}:")
        print(f"  Вес: {current_weight} -> {temp_weight} кг")
        print(f"  Объём: {current_volume:.2f} -> {temp_volume:.2f} м³")
        print(f"  Стоимость: {total_cost} -> {temp_cost} рублей")
        
        if is_feasible and improvement > 0:
            print(f"  Результат: ВОЗМОЖНО с улучшением +{improvement} рублей ✓")
            if improvement > best_improvement:
                best_improvement = improvement
                best_swap = (selected_id, rejected_id, temp_weight, temp_volume, temp_cost)
        elif is_feasible:
            print(f"  Результат: ВОЗМОЖНО, но без улучшения ({improvement:+} рублей)")
        else:
            print(f"  Результат: НЕВОЗМОЖНО (нарушены ограничения по весу или объёму)")
        print()

if best_swap:
    print("=" * 70)
    print("ПРИМЕНЕНИЕ ЛУЧШЕЙ ЗАМЕНЫ")
    print("=" * 70)
    selected_id, rejected_id, new_weight, new_volume, new_cost = best_swap
    print(f"Замена заказа {selected_id} на заказ {rejected_id}")
    print(f"  Вес: {current_weight} -> {new_weight} кг")
    print(f"  Объём: {current_volume:.2f} -> {new_volume:.2f} м³")
    print(f"  Стоимость: {total_cost} -> {new_cost} рублей")
    print(f"  Улучшение: +{best_improvement} рублей")
else:
    print("=" * 70)
    print("РЕЗУЛЬТАТ ЛОКАЛЬНОЙ ОПТИМИЗАЦИИ")
    print("=" * 70)
    print("Выгодных замен не найдено. Жадное решение локально оптимально.")

# Финальный результат
print("\n" + "=" * 70)
print("КОНЕЧНЫЙ РЕЗУЛЬТАТ АЛГОРИТМА")
print("=" * 70)
print(f"Выбранные заказы: {sorted([o['id'] for o in selected_orders])}")
print(f"Общий вес: {current_weight} кг (лимит: {driver_weight_limit} кг)")
print(f"Общий объём: {current_volume:.2f} м³ (лимит: {driver_volume_limit} м³)")
print(f"Общая стоимость: {total_cost} рублей")
print("=" * 70)