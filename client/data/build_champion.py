import json
from collections import OrderedDict

json_data = open('champions.json')
data = json.load(json_data)
champions_array = data['champions']

generated_json = OrderedDict()
for champion in champions_array:
	generated_json[champion['nameEncoded'].lower()] = {'article': ""}

with open('champions_articles.json', 'w') as outfile:
	json.dump(generated_json, outfile, indent=4)

