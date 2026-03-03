package com.securemsg.net

import org.json.JSONArray
import org.json.JSONObject

fun mapToJsonObject(source: Map<String, Any?>): JSONObject {
    val json = JSONObject()
    for ((key, value) in source) {
        json.put(key, anyToJsonValue(value))
    }
    return json
}

private fun anyToJsonValue(value: Any?): Any? {
    return when (value) {
        null -> JSONObject.NULL
        is Map<*, *> -> {
            val nested = JSONObject()
            value.forEach { (k, v) ->
                if (k is String) {
                    nested.put(k, anyToJsonValue(v))
                }
            }
            nested
        }
        is Iterable<*> -> {
            val array = JSONArray()
            value.forEach { item -> array.put(anyToJsonValue(item)) }
            array
        }
        else -> value
    }
}

fun jsonObjectToMap(json: JSONObject): Map<String, Any?> {
    val map = linkedMapOf<String, Any?>()
    val keys = json.keys()
    while (keys.hasNext()) {
        val key = keys.next()
        map[key] = jsonValueToAny(json.get(key))
    }
    return map
}

private fun jsonValueToAny(value: Any?): Any? {
    return when (value) {
        JSONObject.NULL -> null
        is JSONObject -> jsonObjectToMap(value)
        is JSONArray -> (0 until value.length()).map { idx -> jsonValueToAny(value.get(idx)) }
        else -> value
    }
}
