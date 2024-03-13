import argparse
import json
import subprocess

def convert_zotero_data(data):
    formatted_data = []
    for item in data:
        formatted_item = {
            "itemType": item.get("data", {}).get("itemType", ""),
            "title": item.get("data", {}).get("title", ""),
            "abstract": item.get("data", {}).get("abstractNote", "")
        }
        formatted_data.append(formatted_item)
    return formatted_data

def main():
    parser = argparse.ArgumentParser(description='Fetch data from Zotero')
    parser.add_argument('--group', type=int, help='Zotero group ID')
    parser.add_argument('--collection', type=str, help='Zotero collection ID')
    parser.add_argument('--out', type=str, default='result.json', help='Output file path')
    args = parser.parse_args()

    command = ['zotero-lib', '--out', args.out]

    if args.group:
        command.extend(['--group', str(args.group)])
    if args.collection:
        command.extend(['--collection', args.collection])

    try:
        subprocess.run(command, check=True)
        print(f"Data saved to {args.out}")

        # Load the retrieved data from the file
        with open(args.out, 'r') as f:
            data = json.load(f)
        
        formatted_data = convert_zotero_data(data)
        with open(args.out, 'w') as f:
            json.dump(formatted_data, f, indent=2)
        print(f"Formatted data saved to {args.out}")

    except subprocess.CalledProcessError as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
